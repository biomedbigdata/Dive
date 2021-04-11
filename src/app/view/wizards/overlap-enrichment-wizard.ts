import {Component, forwardRef, Inject, ViewChild} from '@angular/core';
import {DeepBlueService} from 'app/service/deepblue';
import {IOperation, IRow} from 'app/domain/interfaces';
import {AppComponent} from 'app/app.component';
import {
    DeepBlueMiddlewareOverlapEnrichtmentResult,
    DeepBlueMiddlewareOverlapEnrichtmentResultItem,
    DeepBlueMiddlewareRequest
} from 'app/domain/operations';
import {RequestManager} from '../../service/requests-manager';
import {Utils} from 'app/service/utils';
import {DefaultData} from '../../service/defaultdata';
import {SelectedData} from 'app/service/selected-data';
import {WizardComponent} from 'angular-archwizard';
import {LolaResultsBarChartComponent} from '../component/charts/lolaresults';

@Component({
    selector: 'overlap-enrichment-wizard',
    templateUrl: './overlap-enrichment-wizard.html'
})
export class OverlapEnrichmentWizard {

    finished = true;

    background: IOperation;
    selected_datasets = new Array<Object>();
    enrichment_data: Object[][] = new Array<Object[]>();

    enrichment_data_from_server = new Array<IRow[]>();

    columns = DeepBlueMiddlewareOverlapEnrichtmentResultItem.asColumns();
    showDataDetail = false;
    selected_ds: any;

    @ViewChild('wizard', {static: true}) wizard: WizardComponent;
    @ViewChild('lolaresultsbarchart', {static: true}) lolaresultsbarchart: LolaResultsBarChartComponent;

    constructor(@Inject(forwardRef(() => AppComponent)) public app: AppComponent,
                public defaultData: DefaultData, public selectedData: SelectedData,
                private requestManager: RequestManager, public deepBlueService: DeepBlueService) {
    }

    ngOnInit(): void {
        this.defaultData.TILING_REGIONS_5K().subscribe((data) => this.background = data);
    }

    inWizard($event: any) {
        if (this.finished) {
            this.finished = false;
            this.app.onMenuButtonClick();
        }
    }

    selectBackgroud(event: IOperation) {
        this.background = event;
    }

    selectDatasets(event: Object[]) {
        // console.log(event);
        this.selected_datasets = event;
    }

    finishWizard($event: any) {
        setTimeout(() => this.app.onMenuButtonClick());
        this.finished = true;
        this.enrichment_data = [];
        this.enrichment_data_from_server = [];
        this.plotBar();
        this.startEnrichment();
    }

    getDatasetsLabel() {
        return 'datasetslabel';
    }

    startEnrichment() {
        const current: IOperation[] = this.getQuerys();

        this.deepBlueService.composedCalculateOverlapsEnrichment(current, this.background.id(), this.selected_datasets)
            .subscribe((request: DeepBlueMiddlewareRequest) => {
                this.requestManager.enqueueRequest(request);
                this.deepBlueService.getComposedResultIterator(request, 'overlaps_enrichment')
                    .subscribe((result: DeepBlueMiddlewareOverlapEnrichtmentResult[]) => {
                        this.prepare_data(result);
                    });
            });
    }


    prepare_data(datum: DeepBlueMiddlewareOverlapEnrichtmentResult[]) {

        // this.lolaresultsbarchart.resize();
        this.enrichment_data_from_server = [];

        for (let pos = 0; pos < datum.length; pos++) {
            const data = datum[pos];
            const rows = data.getResults().map((x: DeepBlueMiddlewareOverlapEnrichtmentResultItem) => {
                const row: IRow = {};
                for (let idx = 0; idx < this.columns.length; idx++) {
                    const column_name = this.columns[idx].name;
                    const v = x[column_name];
                    row[column_name.toLowerCase().replace(/_/g, '')] = Utils.convert(v, this.columns[idx]['column_type'])
                }
                return row;
            });

            rows.sort((a: IRow, b: IRow) => a['meanrank'] - b['meanrank']);

            this.enrichment_data_from_server.push(rows);
        }

        this.filter_enrichment_data(null);
    }


    filter_enrichment_data($event: any) {
        const newResults = [];
        for (let idx = 0; idx < this.enrichment_data_from_server.length; idx++) {
            // const x = this.filter_enrichment_datei(this.enrichment_data_from_server[idx]);
            const x = this.enrichment_data_from_server[idx];
            newResults.push(x);
        }

        this.enrichment_data = newResults;
        this.plotBar();
    }


    wizardClassLength(): string {
        if (this.finished) {
            return 'ui-g-12'
        }
        return 'ui-g-10';
    }

    getQuerys() {
        const querys = this.selectedData.getStacksTopOperation();
        return querys;
    }

    getSelectedDatasets() {
        const keys = [];
        for (const key in this.selected_datasets) {
            keys.push({key: key, value: this.selected_datasets[key]});
        }
        return keys;
    }

    hasNegativeEntries(data): boolean {
        return data.some(d => (d['b'] < 0) || (d['d'] < 0));
    }

    getDatasetsWithNegativeEntries(data) {
        const ds_negative = data.map(d => {
            if ((d['b'] < 0) || (d['d'] < 0)) {
                let ds;
                if (d['description']) {
                    ds = d['description'];
                } else {
                    ds = d['dataset'];
                }
                return ds;
            }
        });
        return 'Negative b or d entries in table. This means either: ' +
            '<br>1) Your user sets contain items outside your universe; or 2) your universe has a region that overlaps multiple ' +
            'user set regions, interfering with the universe set overlap calculation. Dataset(s):<br>' +
            ds_negative.join(', ');
    }

    plotBar() {
        const categories = [];
        const categories_value = new Array<any>();
        const result_by_dataset_stack: {
            [key: string]: {
                [key: string]: string
            }
        } = {};

        for (let stack_pos = 0; stack_pos < this.enrichment_data.length; stack_pos++) {
            const data = this.enrichment_data[stack_pos]; /*.sort(function (a, b) {
                return (a['oddsratio'] < b['oddsratio']) ? 1 : ((b['oddsratio'] < a['oddsratio']) ? -1 : 0);
            });*/
            const values_by_category: { [key: string]: any } = {};

            for (let ds_pos = 0; ds_pos < data.length; ds_pos++) {
                const ds: any = data[ds_pos];
                let category;
                if (ds['description']) {
                    category = ds['description'];
                } else {
                    category = ds['dataset'];
                }
                const oddsratio = ds['oddsratio'];

                // If it is one of top 50 elements of the main stack
                // or if its values was found in the top 50 elements of the main stack
                if (stack_pos === 0 && ds_pos < 50) {
                    categories.push(category);
                    values_by_category[category] = [this.obj2HTMLTable(ds), oddsratio];
                } else if (stack_pos > 0 && categories.indexOf(category) !== -1) {
                    values_by_category[category] = [this.obj2HTMLTable(ds), oddsratio];
                }

                result_by_dataset_stack[category] = {};
            }

            categories_value.push(values_by_category);
        }

        const series: Array<Object> = [];
        for (let stack_pos = 0; stack_pos < categories_value.length; stack_pos++) {
            const stack_values_result: Array<number> = [];
            const stack_categories_values = categories_value[stack_pos];
            for (let cat_pos = 0; cat_pos < categories.length; cat_pos++) {
                const category = categories[cat_pos];
                if (stack_categories_values[category]) {
                    stack_values_result.push(stack_categories_values[category]);
                } else {
                    stack_values_result.push(0)
                }
                result_by_dataset_stack[category][stack_pos] = category;

            }
            series.push({
                name: this.selectedData.getStackname(stack_pos),
                data: stack_values_result,
                color: this.selectedData.getStackColor(stack_pos, '0.3')
            });
        }
        this.lolaresultsbarchart.setNewData(categories, series, result_by_dataset_stack);
        this.lolaresultsbarchart.resize();
    }

    /*  removeSelectedDataset(key : string) {
        debugger;
        let pos = this.selected_datasets[key];
        let x = 1;
      }*/

    setDataInfo($event: any) {
        this.selected_ds = $event;
        this.showDataDetail = true;
    }

    obj2HTMLTable(obj: Object): string {
        let tbl = '<table>';
        for (const [k, v] of Object.entries(obj)) {
            tbl += '<tr><td>' + k + ': </td><td style="text-align: right">' + v + '</td></tr>';
        }
        tbl += '</table>';
        return tbl;
    }
}

