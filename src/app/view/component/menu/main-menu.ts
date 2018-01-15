import { Component, ViewChild, OnInit, Input, OnDestroy } from '@angular/core';

import { Subscription } from 'rxjs/Subscription';

import { MenuItem } from 'primeng/primeng';
import { Dropdown } from 'primeng/primeng';
import { SelectItem } from 'primeng/primeng';

import { Annotation } from 'app/domain/deepblue';
import { EpigeneticMark } from 'app/domain/deepblue';
import { Experiment } from 'app/domain/deepblue';
import { FullMetadata } from 'app/domain/deepblue';
import { Genome } from 'app/domain/deepblue';
import { IdName } from 'app/domain/deepblue';

import { StackValue } from 'app/domain/operations';
import { MenuService } from 'app/service/menu';

import { DataCache } from 'app/service/deepblue';
import { DeepBlueService } from 'app/service/deepblue';
import { MultiKeyDataCache } from 'app/service/deepblue';
import { SelectedData } from 'app/service/selecteddata';
import { DataStack } from 'app/service/datastack';
import { IMenu } from 'app/domain/interfaces';


@Component({
    selector: 'dive-menu',
    template: `
          <length-filtering></length-filtering>
          <dna-pattern-filtering></dna-pattern-filtering>
          `,
})
export class DiveStatus {
    menus: IMenu[] = [];
    constructor(private deepBlueService: DeepBlueService, private menuService: MenuService) {
        this.menus = [
            new GenomeSelectorMenu(this.deepBlueService, this.menuService),
            new CSSExperimentsMenu(this.deepBlueService, this.menuService),
            new EpigeneticMarkMenu(this.deepBlueService, this.menuService)
        ];

        this.menus.forEach((menu: IMenu) => {
            menu.loadMenu();
        });
    }
}


// Building Menu Items with Genome names
class GenomeSelectorMenu implements IMenu {

    errorMessage: string;

    constructor(private deepBlueService: DeepBlueService, private menuService: MenuService) { }

    loadMenu(): any {
        return this.deepBlueService.getGenomes().subscribe(genomes => {
            this.deepBlueService.setGenome(genomes[0]);

            for (let genome of genomes) {
                this.menuService.includeItem('genomes', genome.name, 'fiber_manual_record',
                    (event: any) => { this.selectItem(genome) },
                    ['/'], /* router link */
                    null /* url */
                );
            }
            return true;
        },
            error => this.errorMessage = <any>error
        );
    }

    selectItem(genome: Genome) {
        this.deepBlueService.setGenome(genome);
    }
}


export class EpigeneticMarkMenu implements IMenu {
    errorMessage: string;
    genomeSubscription: Subscription;
    actualItems = new Array<string>();

    private static readonly SPECIAL_CASES = ['DNA Methylation', 'State Segmentation'];

    constructor(private deepBlueService: DeepBlueService, private menuService: MenuService) { }

    loadMenu(): any {

        this.genomeSubscription = this.deepBlueService.genomeValue$.subscribe(genome => {
            if (genome === null) {
                return;
            }
            this.deepBlueService.getComposedEpigeneticMarksCategories().subscribe((categories: string[]) => {

                if (this.actualItems.length > 0) {
                    for (let item of this.actualItems) {
                        this.menuService.remove(item);
                    }
                }

                this.actualItems = categories;
                for (let category of categories) {

                    // Do not include the SPECIAL CASES menu
                    if (EpigeneticMarkMenu.SPECIAL_CASES.indexOf(category) > -1) {
                        continue;
                    }

                    this.deepBlueService.getComposedEpigeneticMarksFromCategory(category).subscribe(ems => {
                        this.menuService.add(category);

                        for (let em of ems) {

                            this.menuService.includeItem(category, em.name, 'fiber_manual_record',
                                (event: any) => this.selectItem(em),
                                ['/peaks_overlap'],
                                null
                            );
                        }

                    },
                        error => this.errorMessage = <any>error);
                }
            });
        })
    }

    selectItem(epigenetic_mark: EpigeneticMark) {
        this.deepBlueService.setEpigeneticMark(epigenetic_mark);
    }
}

export class CSSExperimentsMenu implements IMenu {
    errorMessage: string;
    genomeSubscription: Subscription;

    constructor(private deepBlueService: DeepBlueService, private menuService: MenuService) { }

    loadMenu() {
        this.genomeSubscription = this.deepBlueService.genomeValue$.subscribe(genome => {
            if (genome === null) {
                return;
            }
            this.deepBlueService.getChromatinStateSegments().subscribe((csss: string[]) => {

                this.menuService.remove('css');

                if (csss.length > 0) {
                    this.menuService.add('css', 'Chromatin State Segmentation', 'change_history');
                    for (let css of csss) {
                        this.menuService.includeItem('css', css[1], 'fiber_manual_record',
                            (event: any) => { this.selectItem(css[0]) },
                            ['/chromatin_states'], /* router link */
                            null /* url */
                        );
                    }
                }
            });
        },
            error => this.errorMessage = <any>error
        );
    }

    selectItem(css: string) {
        this.deepBlueService.setEpigeneticMark(new EpigeneticMark(["Chromatin State Segmentation", css]));
    }
}

///