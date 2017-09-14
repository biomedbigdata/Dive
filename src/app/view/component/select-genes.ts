import { Component, OnDestroy, ViewChild } from '@angular/core';

import {
    Annotation,
    BioSource,
    EpigeneticMark,
    Experiment,
    IdName,
    Technique,
    Project,
    Gene,
    GeneModel,
} from 'app/domain/deepblue';

import { DeepBlueService } from 'app/service/deepblue';
import { Subscription } from 'rxjs';
import { Dropdown } from 'primeng/primeng';

@Component({
    selector: 'select-genes-component',
    templateUrl: './select-genes.html'
})

export class SelectGenesComponent implements OnDestroy {
    errorMessage: any;

    @ViewChild('geneModelDropdown') geneModelDropdown: Dropdown;

    menuGeneModel: { label: string; value: GeneModel; }[];
    geneModels: GeneModel[];
    selectedGeneModel: GeneModel;

    gene: Gene = null;
    genes_suggestions = new Array<Gene>();
    gene_model = "";

    selected_genes: Gene[] = [];

    dt_selected_gene: Gene[] = [];

    genomeSubscription: Subscription;

    datatable_columns = [
        { name: 'name', prop: 'data.gene_name', column_type: 'string' },
        { name: 'id', prop: 'data.gene_id', column_type: 'string' },
    ];

    constructor(private deepBlueService: DeepBlueService) {
        this.genomeSubscription = deepBlueService.genomeValue$.subscribe(genome => {
            if (genome.id === '') {
                return;
            }
            this.deepBlueService.getGeneModelsBySelectedGenome().subscribe((geneModels: GeneModel[]) => {
                if (geneModels.length === 0) {
                    return;
                }
                this.geneModels = geneModels;
                this.menuGeneModel = geneModels.map((geneModel: GeneModel) => {
                    const l = { label: geneModel.name, value: geneModel };
                    this.geneModelDropdown.selectItem(null, l);
                    return l;
                });
            },
                error => this.errorMessage = <any>error);
        });
    }

    selectGeneModel(event) {
        this.selectedGeneModel = event.value;
    }

    search_genes(event) {
        let gene_name = event.query;
        if (gene_name.length < 3) {
            return;
        }
        console.log(this.selectedGeneModel.name, event.query);
        this.deepBlueService.getComposedListGenes(this.selectedGeneModel.name, event.query).subscribe((genes: Gene[]) => {
            this.genes_suggestions = genes
        });
    }

    handle_dropdown_genes(event) {
        debugger;
    }

    content_changed() {
        if (this.selected_genes.indexOf(this.gene) == -1) {
            this.selected_genes.push(this.gene);
        }
    }

    select_click() {
        debugger;
        console.log(this.gene);
    }

    ngOnDestroy() {
        this.genomeSubscription.unsubscribe();
    }
}
