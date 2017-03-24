import { BioSourcesScreen } from './biosources';
import { Experiment } from '../../domain/deepblue';
import { Component, OnInit, ViewChild } from '@angular/core';

import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable'

import { SelectItem } from 'primeng/primeng';
import { MultiSelect } from 'primeng/primeng';

import { BioSource } from 'app/domain/deepblue';
import { EpigeneticMark } from 'app/domain/deepblue';
import { FullExperiment } from 'app/domain/deepblue';
import { Genome } from 'app/domain/deepblue';
import { IdName } from 'app/domain/deepblue';
import { DeepBlueOperation } from 'app/domain/operations';
import { DeepBlueResult } from 'app/domain/operations';
import { StackValue } from 'app/domain/operations';

import { DeepBlueService } from 'app/service/deepblue';
import { DataStack } from 'app/service/datastack';
import { SelectedData } from 'app/service/selecteddata';
import { ProgressElement } from 'app/service/progresselement';

@Component({
    selector: 'overlaps-bar-chart',
    styles: [`
      chart {
        display: block;
      }
    `],
    template: `
        <chart [options]="options" (load)="saveInstance($event.context)">></chart>
    `
})
export class OverlapsBarChart {
    options: Object;
    chart: Object;
    result_by_dataset_stack: Object;

    setNewData(categories, series, result_by_dataset_stack) {
        console.log(series);
        this.chart["xAxis"][0].setCategories(categories, false);

        let point = {
            events: {
                click: function (click, e) {
                    // dummy function
                }
            }
        };

        let dataLabels = {
            enabled: true,
            rotation: -90,
            color: '#FFFFFF',
            align: 'right',
            format: '{point.y:.1f}', // one decimal
            y: 10, // 10 pixels down from the top
            style: {
                fontSize: '12px',
                fontFamily: 'Verdana, sans-serif'
            }
        };

        while (this.chart["series"].length > 0) {
            this.chart["series"][0].remove(false);
        }

        for (let serie of series) {
            serie["point"] = point;
            serie['point']['events']['click'] = (ev) => this.clickExperimentBar(ev);
            serie["dataLabels"] = dataLabels;
            this.chart["addSeries"](serie, false);
        }

        this.result_by_dataset_stack = result_by_dataset_stack;

        this.chart["redraw"]();
    }

    hasData(): boolean {
        if (!this.chart) {
            return false;
        }
        return this.chart["series"][0]["data"].length > 0;
    }

    saveInstance(chartInstance) {
        this.chart = chartInstance;
    }

    constructor(private deepBlueService: DeepBlueService) {
        this.options = {
            title: {
                text: `Overlapping with ${deepBlueService.getAnnotation().name}`
            },
            xAxis: {
                categories: []
            },
            credits: {
                enabled: false
            },
            width: null,
            height: null,
            yAxis: {
                min: 0,
                title: {
                    text: 'Overlaped peaks (regions)'
                }
            },
            legend: {
                enabled: false
            },
            tooltip: {
                formatter: function () {
                    var s;
                    if (this.point.name) { // the pie chart
                        s = this.point.name + ' ' + this.y + ' fruits';
                    } else {
                        s = this.series.name + ' : ' +
                            this.x + ': ' + this.y;
                    }
                    return s;
                }
            },
            series: []
        }
    }

    clickExperimentBar(click) {
        let point = click.point;
        let category = point.category;
        let index = point.series.columnIndex;

        let stack_value: StackValue = this.result_by_dataset_stack[category][point.series.columnIndex];
        this.deepBlueService.setDataInfoSelected(stack_value);


        setTimeout(() => this.chart["reflow"](), 0);
    }
}


@Component({
    templateUrl: './histones.html'
})
export class HistonesScreen {
    errorMessage: string;
    experiments: FullExperiment[];
    segregated_data: Object;

    biosourcesItems: SelectItem[] = [];
    selectedMultiSelectBiosources: Object[] = [];

    epigeneticMarkSubscription: Subscription;

    defaultSelectBiosourcesLabel: string = "Select the Biosource"

    selectedExperimentsSource = new BehaviorSubject<IdName[]>([]);
    selectedExperimentsValue$: Observable<IdName[]> = this.selectedExperimentsSource.asObservable();


    selectedBioSourcesSource = new BehaviorSubject<IdName[]>([]);
    selectedBioSourcesValue$: Observable<IdName[]> = this.selectedBioSourcesSource.asObservable();

    currentlyProcessing: Object[] = [];

    current_request: number = 0;

    data: any;

    hasData: boolean = false;

    @ViewChild('overlapbarchart') overlapbarchart: OverlapsBarChart;
    @ViewChild('multiselect') multiselect: MultiSelect;

    segregate(experiments: FullExperiment[]) {

        let biosources = {}
        let samples = {}
        let epigenetic_marks = {}
        let techniques = {}
        let projects = {}

        let event_items = [];
        let pre_selected_biosources = this.deepBlueService.selectedBioSources.getValue().map((x: BioSource) => x.name);

        this.biosourcesItems = [];
        this.selectedMultiSelectBiosources = [];

        for (let experiment of experiments) {
            let experiment_biosource = experiment.sample_info()['biosource_name'];
            let experiment_sample_id = experiment.sample_id();
            let experiment_epigenetic_mark = experiment.epigenetic_mark();
            let experiment_technique = experiment.technique();
            let experiment_project = experiment.project();

            if (!(experiment_biosource in biosources)) {
                biosources[experiment_biosource] = []
                let l = { label: experiment_biosource, value: { name: experiment_biosource, experiments: biosources[experiment_biosource] } }
                this.biosourcesItems.push(l);

                console.log(l.label);
                console.log(pre_selected_biosources);

                if (pre_selected_biosources.indexOf(l.label) > -1) {
                    event_items.push(l.value);
                    this.selectedMultiSelectBiosources.push(l.value);
                }
            }

            if (!(experiment_sample_id in samples)) {
                samples[experiment_sample_id] = []
            }

            if (!(experiment_epigenetic_mark in epigenetic_marks)) {
                epigenetic_marks[experiment_epigenetic_mark] = []
            }

            if (!(experiment_technique in techniques)) {
                techniques[experiment_technique] = []
            }

            if (!(experiment_project in projects)) {
                projects[experiment_project] = []
            }

            biosources[experiment_biosource].push(experiment);
            samples[experiment_sample_id].push(experiment);
            epigenetic_marks[experiment_epigenetic_mark].push(experiment);
            techniques[experiment_technique].push(experiment);
            projects[experiment_project].push(experiment);
        }

        this.selectBiosources({ value: event_items });

        return {
            "biosources": biosources,
            "samples": samples,
            "epigenetic_marks": epigenetic_marks,
            "techniques": techniques,
            "projects": projects
        }
    }

    constructor(private deepBlueService: DeepBlueService,
        public progress_element: ProgressElement, private selectedData: SelectedData) {

        this.epigeneticMarkSubscription = deepBlueService.epigeneticMarkValue$.subscribe(selected_epigenetic_mark => {
            this.deepBlueService.getExperiments(deepBlueService.getGenome(), selected_epigenetic_mark).subscribe(experiments_ids => {
                var ids = experiments_ids.map((e) => e.id);
                this.deepBlueService.getExperimentsInfos(ids).subscribe(full_info => {
                    this.experiments = <FullExperiment[]>full_info;
                    this.segregated_data = this.segregate(<FullExperiment[]>full_info);
                });
            },
                error => this.errorMessage = <any>error);
        });

        this.selectedExperimentsValue$.debounceTime(250).subscribe(() => this.processOverlaps());
        this.selectedData.getActiveTopStackValue().subscribe((dataStackItem) => this.processOverlaps())
    }

    processOverlaps() {
        let experiments = this.selectedExperimentsSource.getValue();

        if (experiments.length == 0) {
            this.reloadPlot([]);
            return;
        }

        if (experiments != this.selectedExperimentsSource.getValue()) {
            this.reloadPlot([]);
            return;
        }

        if (experiments == this.currentlyProcessing) {
            return;
        }
        this.current_request++;

        // Each experiment is started, selected, overlaped, count, get request data (4 times each)
        this.progress_element.reset(experiments.length * this.selectedData.getStacksTopOperation().length * 5, this.current_request);
        this.currentlyProcessing = experiments;

        this.deepBlueService.selectMultipleExperiments(experiments, this.progress_element, this.current_request).subscribe((selected_experiments: DeepBlueOperation[]) => {
            if (selected_experiments.length == 0) {
                this.reloadPlot([]);
                return;
            }
            if (selected_experiments[0].request_count != this.current_request) {
                return;
            }

            let current: DeepBlueOperation[] = this.selectedData.getStacksTopOperation();

            if (current == null) {
                this.reloadPlot([]);
                return;
            }

            this.deepBlueService.intersectWithSelected(current, selected_experiments, this.progress_element, this.current_request).subscribe((overlap_ids: StackValue[]) => {
                if (overlap_ids.length == 0) {
                    this.reloadPlot([]);
                    return;
                }
                if (overlap_ids[0].getDeepBlueOperation().request_count != this.current_request) {
                    return;
                }

                this.deepBlueService.countRegionsBatch(overlap_ids, this.progress_element, this.current_request).subscribe((datum: StackValue[]) => {
                    if (datum.length == 0) {
                        this.reloadPlot([]);
                        return;
                    }
                    if (datum[0].getDeepBlueOperation().request_count != this.current_request) {
                        return;
                    }

                    this.currentlyProcessing = [];
                    this.reloadPlot(datum);
                })
            });
        });
    }

    selectBiosources(event) {
        let experiments: IdName[] = [];
        let selected_data = event.value;
        let biosources = event.value.map((x) => x.name);

        let exp_arrays = event.value.map((x) => x.experiments)
        experiments = experiments.concat.apply([], exp_arrays);

        this.selectedExperimentsSource.next(experiments);
        this.selectedBioSourcesSource.next(biosources);
    }

    reloadPlot(datum: StackValue[]) {

        let result_by_dataset_stack = {};
        let categories = [];


        let value_by_stack_biosource: Array<Array<Array<StackValue>>> = [];

        for (let result of datum) {
            let stack = result.stack;

            let experiment = <FullExperiment>result.getDeepBlueResult().data;
            let biosource = experiment.biosource();

            if (!(stack in value_by_stack_biosource)) {
                value_by_stack_biosource[stack] = [];
            }

            if (!(biosource in value_by_stack_biosource[stack])) {
                if (!(biosource in categories)) {
                    categories.push(biosource);
                }
                value_by_stack_biosource[stack][biosource] = [];
            }

            value_by_stack_biosource[stack][biosource].push(result);
            result_by_dataset_stack[biosource] = [];
        }

        let value_by_stack: Array<Array<Object>> = [];

        for (let stack_pos: number = 0; stack_pos < value_by_stack_biosource.length; stack_pos++) {
            if (!(stack_pos in value_by_stack)) {
                value_by_stack[stack_pos] = [];
            }
            for (let biosource in value_by_stack_biosource[stack_pos]) {
                let stacks = value_by_stack_biosource[stack_pos][biosource];

                let high = Number.MIN_SAFE_INTEGER;
                let low = Number.MAX_SAFE_INTEGER;
                let sum = 0;

                let values: Array<number> = [];
                for (let stack of stacks) {
                    let count = stack.getDeepBlueResult().resultAsCount();
                    if (count < low) {
                        low = count;
                    }
                    if (count > high) {
                        high = count;
                    }
                    sum += count;
                    values.push(count);
                }

                values.sort((a, b)=> {return a-b});

                let mean = sum / values.length;
                let mid_pos = values.length / 2;
                let median = values[mid_pos];
                let q3 = values[mid_pos + (mid_pos / 2)]
                let q1 = values[mid_pos - (mid_pos / 2)]

                let aggr = { low: low, q1: q1, median: median, q3: q3, high: high, mean: mean, elements: values.length }

                value_by_stack[stack_pos].push({ biosource: biosource, value: aggr })
            }
        }


        let series: Array<Object> = [];
        for (let stack_pos: number = 0; stack_pos < value_by_stack.length; stack_pos++) {
            let stack_values = value_by_stack[stack_pos];
            let stack_values_result: Array<number> = [];
            let stack_values_result_boxplot: Array<Object> = [];

            stack_values.sort((a: Object, b: Object) => {
                return (<string>a['biosource']).localeCompare(b['biosource']);
            });

            for (let i = 0; i < stack_values.length; i++) {
                let stack_value = stack_values[i];
                stack_values_result.push(stack_value['value']['mean']);
                stack_values_result_boxplot.push([
                    stack_value['value']['low'],
                    stack_value['value']['q1'],
                    stack_value['value']['median'],
                    stack_value['value']['q3'],
                    stack_value['value']['high']
                ]);
                result_by_dataset_stack[stack_value['biosource']][stack_pos] = stack_value;
            }
            debugger;
            //series.push({ type: 'column', name: stack_pos.toString(), data: stack_values_result, color: this.selectedData.getStackColor(stack_pos) });
            series.push({ type: 'boxplot', name: stack_pos.toString(), data: stack_values_result_boxplot, color: this.selectedData.getStackColor(stack_pos) });
        }

        this.overlapbarchart.setNewData(categories, series, result_by_dataset_stack);
    }

    selectExperimentBar(e) {
        let dataset = e.dataset;
        let element = e.element;
        let position = element._index;
    }

    hasDataDetail(): boolean {
        return this.deepBlueService.getDataInfoSelected() != null;
    }

    ngOnDestroy() {
        this.epigeneticMarkSubscription.unsubscribe();
    }
}