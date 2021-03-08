import {Injectable} from '@angular/core';

import {Observable} from 'rxjs/Observable'
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {DeepBlueService} from 'app/service/deepblue';
import {EpigeneticMark} from 'app/domain/deepblue';


const BASIC_MENU: any[] = [
  { label: 'Data Wizard', icon: 'view_carousel', routerLink: ['/'] },
  { label: 'Data Advanced', icon: 'format_list_bulleted', items: [
      { label: 'Select Query', icon: 'format_list_bulleted', routerLink: ['/dataselection'] },
      { label: 'Similar Data', icon: 'compare_arrows', routerLink: ['/similarfinder'] },
      { label: 'Comparison Selection', icon: 'compare', routerLink: ['comparisonselection'] },
      { label: 'Get regions', icon: 'dehaze', routerLink: ['/regions'] }
    ] },
  { label: 'Filter & Transform', icon: 'transform', items: [
      { label: 'Transform Regions', icon: 'transform', routerLink: ['/transform'] },
      { name: 'filtering', label: 'Filtering', icon: 'pause', items: [] },
      { name: 'columns', label: 'Columns Filtering', icon: 'view_week', items: [] }
    ] },
  { name: 'quick_overlaps', label: 'Quick Overlaps', icon: 'vertical_align_center', items: [
      { name: 'genes', label: 'Genes', icon: 'room', routerLink: ['/genes'] }] },
  { name: 'go_enrichment', label: 'Gene Ontology', icon: 'dashboard_customize', routerLink: ['/go_enrichment'] },
  { name: 'overlap_enrichment', label: 'Overlap Enrichment', icon: 'view_quilt', routerLink: ['/overlap_enrichment'] }
];

const EXTRA_MENU_ITEMS: any[] = [
]

export interface IMenu {
  reloadMenu(): any;
  selectItem(item: any): any;
}

@Injectable()
export class DiveMenuService {
  model: any[] = [];

  menus: IMenu[] = [];

  public menuItems = new BehaviorSubject<Object[]>(this.model);
  menuValue$: Observable<Object[]> = this.menuItems.asObservable();

  constructor(private deepBlueService: DeepBlueService) {
    this.menus = [
      new CSSExperimentsMenu(this.deepBlueService, this),
      new EpigeneticMarkMenu(this.deepBlueService, this)
    ];

    this.menus.forEach((menu: IMenu) => {
      menu.reloadMenu();
    });


    this.deepBlueService.dataToDiveValue$.subscribe(data => {

      if (data !== null) {
        this.model = BASIC_MENU;
        this.model = this.model.concat(EXTRA_MENU_ITEMS);
      }

      this.menuItems.next(this.model);
    })
  }

  findMenu(parentName: string): any {
    for (let m of this.model) {
      if (m.name == parentName) {
        return m
      } else if ('items' in m) {
         let subM = m.items.find(i => i.name == parentName);
         if (subM) {
           return subM;
         }
    }
    }
    return undefined;
  }

  findMenuPos(parentName: string): number {
    return this.model.findIndex(m => m.name == parentName);
  }

  pushItem(subMenu: any, item: any) {
    if ('items' in subMenu) {

      if (subMenu['items'].find((i: any) => i.label == item.label)) {
        return;
      }

      subMenu['items'].push(item);
    } else {
      subMenu['items'] = [item];
    }
  }

  add(parentName: string, label?: string, icon?: string) {
    let item = {
      name: parentName,
      label: parentName,
      icon: 'change_history',
      items: new Array<Object>()
    };

    if (label) {
      item.label = label;
    }

    if (icon) {
      item.icon = icon
    }

    this.model.push(item);
  }

  remove(parentName: string) {
    let pos = this.findMenuPos(parentName);
    if (pos > -1) {
      this.model.splice(pos, 1);
    }
  }

  reset(parentName: string) {
    const subMenu = this.findMenu(parentName);
    if (!subMenu) {
      this.add(parentName);
    } else {
      subMenu['items'] = [];
    }
  }

  includeItem(parentName: string, label: string, icon: string, command: any, routerLink: any, url: any) {
    const subMenu = this.findMenu(parentName);
    if (!subMenu) {
      console.error('Sub Menu ' + parentName + ' not found');
      return;
    }

    const item: any = { 'label': label };
    if (icon) {
      item['icon'] = icon;
    }
    if (command) {
      item['command'] = command;
    }
    if (routerLink) {
      item['routerLink'] = routerLink;
    }
    if (url) {
      item['url'] = url;
    }

    this.pushItem(subMenu, item);
  }

  includeObject(parentName: string, item: Object) {
    const subMenu = this.findMenu(parentName);
    if (!subMenu) {
      console.error('Sub Menu ' + parentName + ' not found');
      return;
    }
    this.pushItem(subMenu, item);
  }
}


export class EpigeneticMarkMenu implements IMenu {
  errorMessage: string;

  private static readonly SPECIAL_CASES = ['DNA Methylation', 'State Segmentation', 'Chromatin State Segmentation'];

  constructor(private deepBlueService: DeepBlueService, private diveMenu: DiveMenuService) { }

  reloadMenu(): any {
    this.deepBlueService.dataToDiveValue$.subscribe(data => {
      if (data === null) {
        return;
      }

      this.deepBlueService.getComposedEpigeneticMarksCategories().subscribe((categories: string[]) => {

        for (let category of categories) {
          // Do not include the SPECIAL CASES menu
          if (EpigeneticMarkMenu.SPECIAL_CASES.indexOf(category) > -1) {
            continue;
          }

          this.deepBlueService.getComposedEpigeneticMarksFromCategory(category).subscribe(ems => {
            const subMenu = this.diveMenu.findMenu(category);
            if (!subMenu) {
              this.diveMenu.includeObject('quick_overlaps', {
                name: category,
                label: category,
                icon: 'change_history',
                items: new Array<Object>()
              });
            } else {
              subMenu['items'] = [];
            }

            for (let em of ems) {
              this.diveMenu.includeItem(category, em.name, 'fiber_manual_record',
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

  constructor(private deepBlueService: DeepBlueService, private diveMenu: DiveMenuService) { }

  reloadMenu() {
    this.deepBlueService.dataToDiveValue$.subscribe(data => {
      if (data === null) {
        return;
      }
      this.deepBlueService.getChromatinStateSegments().subscribe((csss: string[][]) => {
        if (csss.length > 0) {
          this.diveMenu.remove('css');
          this.diveMenu.includeObject('quick_overlaps', {name: 'css', label: 'Chromatin State Segmentation', icon: 'change_history', items: new Array<Object>()});
          csss.sort((a, b) => a[1].localeCompare(b[1  ]));
          for (let css of csss) {
            this.diveMenu.includeItem('css', css[1], 'fiber_manual_record',
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
    this.deepBlueService.setEpigeneticMark(new EpigeneticMark(["Chromatin State Segmentation:" + css, css]));
  }
}
