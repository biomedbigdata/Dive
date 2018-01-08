import { DataLoadProgressBar } from '../view/component/progressbar';
import { Injectable } from '@angular/core';

import { Http, Response, Headers, URLSearchParams } from '@angular/http';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import {
    Annotation,
    BioSource,
    EpigeneticMark,
    Experiment,
    FullAnnotation,
    FullExperiment,
    FullGeneModel,
    FullMetadata,
    GeneModel,
    Genome,
    IdName,
    Technique,
    Project,
    Gene,
    Id
} from '../domain/deepblue';

import { IKey } from '../domain/interfaces';

import {
    DeepBlueMiddlewareGOEnrichtmentResult,
    DeepBlueMiddlewareOverlapResult,
    DeepBlueOperation,
    DeepBlueRequest,
    DeepBlueResult,
    FilterParameter,
    DeepBlueTiling,
    DeepBlueMiddlewareOverlapEnrichtmentResult,
    DeepBlueDataParameter,
    DeepBlueOperationArgs,
    StackValue,
    DeepBlueMiddlewareRequest,
    DeepBlueMiddlewareOverlapEnrichtmentResultItem,
    AbstractDeepBlueRequest,
} from '../domain/operations';

import { ProgressElement } from '../service/progresselement';

import { ICloneable, IOperation } from '../domain/interfaces';


export class DataCache<T extends IKey, V extends ICloneable> {

    constructor(private _data: Map<string, V> = new Map()) { }

    put(key: T, value: V) {
        const cloneValue = value.clone(-1);
        this._data.set(key.key(), cloneValue);
    }

    get(key: T, request_count: number): V {
        const value: V = this._data.get(key.key());
        if (value) {
            return value.clone(request_count);
        } else {
            return null;
        }
    }
}

export class MultiKeyDataCache<T extends IKey, V extends ICloneable> {

    constructor(private _data: Map<string, V> = new Map()) { }

    put(keys: T[], value: V) {
        const key_value = keys.map((k) => k.key()).join();
        const cloneValue = value.clone(-1);
        this._data.set(key_value, cloneValue);
    }

    get(keys: T[], request_count: number): V {
        const key_value = keys.map((k) => k.key()).join();
        const value: V = this._data.get(key_value);
        if (value) {
            return value.clone(request_count);
        } else {
            return null;
        }
    }
}

@Injectable()
export class DeepBlueService {
    private deepBlueUrl = 'api';

    // Observable string sources
    public genomeSource = new BehaviorSubject<Genome>(null);
    public dataToDiveSource = new BehaviorSubject<IOperation>(null);
    public epigeneticMarkSource = new BehaviorSubject<EpigeneticMark>(new EpigeneticMark(['', '']));
    public dataInfoSelectedSource = new BehaviorSubject<any>(null);

    public selectedBioSources = new BehaviorSubject<BioSource[]>([]);

    // Observable string streams
    genomeValue$ = this.genomeSource.asObservable();
    dataToDiveValue$ = this.dataToDiveSource.asObservable();
    epigeneticMarkValue$ = this.epigeneticMarkSource.asObservable();
    dataInfoSelectedValue$ = this.dataInfoSelectedSource.asObservable();
    selectedBioSourcesValue$ = this.selectedBioSources.asObservable();

    idNamesQueryCache = new DataCache<IdName, DeepBlueOperation>();
    intersectsQueryCache = new MultiKeyDataCache<DeepBlueOperation, IOperation>();
    overlapsQueryCache = new DataCache<IKey, DeepBlueOperation>();
    filtersQueryCache = new DataCache<IKey, DeepBlueOperation>();
    operationCache = new DataCache<IOperation, IOperation>();
    requestCache = new DataCache<IOperation, DeepBlueRequest>();
    resultCache = new DataCache<DeepBlueRequest, DeepBlueResult>();

    biosourcesCache: Array<BioSource> = null;

    setDataInfoSelected(cliked_data: any) {
        this.dataInfoSelectedSource.next(cliked_data);
    }

    getDataInfoSelected(): Object {
        return this.dataInfoSelectedSource.getValue();
    }

    // Service messages
    setGenome(genome: Genome) {
        this.genomeSource.next(genome);
    }

    /* Define the annotation that we are going to dive */
    setDataToDive(dataToDive: IOperation) {
        this.dataToDiveSource.next(dataToDive);
    }

    setEpigeneticMark(epigeneticMark: EpigeneticMark) {
        this.epigeneticMarkSource.next(epigeneticMark);
    }

    getGenome(): Genome {
        return this.genomeSource.getValue();
    }

    getDivingData(): IOperation {
        return this.dataToDiveSource.getValue();
    }


    getSelectedEpigeneticMark(): EpigeneticMark {
        return this.epigeneticMarkSource.getValue();
    }

    //

    constructor(private http: Http, public progress_element: ProgressElement) {
        console.log('NEW DEEPBLUE SERVICE');
    }

    // Functions to select data from the Server

    getChromosomes(): Observable<String[]> {
        if (!this.getGenome()) {
            return Observable.empty<String[]>();
        }

        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
    }

    listEpigeneticMarks(): Observable<EpigeneticMark[]> {
        if (!this.getGenome()) {
            return Observable.empty<EpigeneticMark[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', 'epigenetic_marks');
        params.set('type', 'peaks');
        return this.http.get(this.deepBlueUrl + '/collection_experiments_count', { 'search': params })
            .map(this.extractEpigeneticMarks)
            .catch(this.handleError);
    }

    getHistones(): Observable<EpigeneticMark[]> {
        if (!this.getGenome()) {
            return Observable.empty<EpigeneticMark[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', 'epigenetic_marks');
        params.set('type', 'peaks');
        return this.http.get(this.deepBlueUrl + '/collection_experiments_count', { 'search': params })
            .map(this.extractHistone)
            .catch(this.handleError);
    }

    getChromatinStateSegments(): Observable<string[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        return this.http.get(this.deepBlueUrl + '/composed_commands/chromatin_states_by_genome', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];
                // Remove the numbers and the _
                return Object.keys(data).map((k) => [k, k.replace(/[0-9]+_/, "").replace(/_/g, " ")]).sort();
            })
            .catch(this.handleError);
    }

    getAnnotations(genome: Genome): Observable<Annotation[]> {
        if (!genome) {
            return Observable.empty<Annotation[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', genome.name);
        return this.http.get(this.deepBlueUrl + '/list_annotations', { 'search': params })
            .map(this.extractAnnotation)
            .catch(this.handleError);
    }

    listBioSources(): Observable<BioSource[]> {
        if (!this.getGenome()) {
            return Observable.empty<BioSource[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', 'biosources');
        params.set('type', 'peaks');
        return this.http.get(this.deepBlueUrl + '/collection_experiments_count', { 'search': params })
            .map(this.extractBioSources)
            .do((biosources) => this.biosourcesCache = biosources)
            .catch(this.handleError);
    }

    getBioSourceByName(name: string): BioSource {
        for (let biosource of this.biosourcesCache) {
            if (biosource.name == name) {
                return biosource;
            }
        }
        return null;
    }

    listTechniques(): Observable<Technique[]> {
        if (!this.getGenome()) {
            return Observable.empty<Technique[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', 'techniques');
        params.set('type', 'peaks');
        return this.http.get(this.deepBlueUrl + '/collection_experiments_count', { 'search': params })
            .map(this.extractBioSources)
            .catch(this.handleError);
    }

    listProjects(): Observable<Project[]> {
        if (!this.getGenome()) {
            return Observable.empty<Project[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', 'projects');
        params.set('type', 'peaks');
        return this.http.get(this.deepBlueUrl + '/collection_experiments_count', { 'search': params })
            .map(this.extractProjects)
            .catch(this.handleError);
    }

    listExperiments(epigenetic_marks: EpigeneticMark[], biosources: BioSource[], techniques: Technique[], projects: Project[]): Observable<Experiment[]> {
        if (!this.getGenome()) {
            return Observable.empty<Project[]>();
        }
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', 'projects');
        params.set('type', 'peaks');

        epigenetic_marks.forEach(em => {
            params.set("epigenetic_mark", em.name);
        });

        biosources.forEach(bs => {
            params.set("biosource", bs.name);
        });

        techniques.forEach(tc => {
            params.set("technique", tc.name);
        });

        projects.forEach(pj => {
            params.set("project", pj.name);
        });

        return this.http.get(this.deepBlueUrl + '/list_experiments', { 'search': params })
            .map(this.extractExperiments)
            .catch(this.handleError);
    }



    private extractBioSources(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return new BioSource(value);
        }).sort((a: BioSource, b: BioSource) => a.name.localeCompare(b.name));
    }

    private extractEpigeneticMarks(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return new EpigeneticMark(value);
        }).sort((a: EpigeneticMark, b: EpigeneticMark) => a.name.localeCompare(b.name));
    }

    private extractProjects(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return new Project(value);
        }).sort((a: Project, b: Project) => a.name.localeCompare(b.name));
    }

    private extractExperiments(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return new Experiment(value);
        }).sort((a: Experiment, b: Experiment) => a.name.localeCompare(b.name));
    }

    private extractHistone(res: Response) {
        const body = res.json();
        let data = body[1] || [];
        const regexp = new RegExp('h([134]|2[ab])([a-z])([0-9]+)(.*)');

        data = data.filter((em: string) => {
            // em[1] is where the name is
            return regexp.test(em[1].toLowerCase());
        }).sort((em1: string, em2: string) => {
            return em1[1].localeCompare(em2[1]);
        });

        return data.map((value: string[]) => {
            return (new EpigeneticMark(value));
        }).sort((a: IdName, b: IdName) => a.name.localeCompare(b.name));
    };

    private extractFullMetadata(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return FullMetadata.fromObject(value);
        }).sort((a: FullMetadata, b: FullMetadata) => a.name.localeCompare(b.name));
    }

    getGenomes(): Observable<Genome[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('controlled_vocabulary', 'genomes');
        params.set('type', 'peaks');
        return this.http.get(this.deepBlueUrl + '/collection_experiments_count', { 'search': params })
            .map(this.extractGenomes)
            .catch(this.handleError);
    }

    private extractGenomes(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return new Genome(value);
        }).sort((a: IdName, b: IdName) => a.name.localeCompare(b.name));
    }

    private extractAnnotation(res: Response) {
        const body = res.json();
        const data = body[1] || [];
        return data.map((value: string[]) => {
            return new Annotation(value);
        }).sort((a: IdName, b: IdName) => a.name.localeCompare(b.name));
    }

    getExperiments(genome: Genome, epigenetic_mark: IdName | string): Observable<IdName[]> {
        if (!genome) {
            return Observable.empty<IdName[]>();
        }

        if (!epigenetic_mark) {
            return Observable.empty<IdName[]>();
        }

        let epigenetic_mark_name = "";
        if (epigenetic_mark instanceof IdName) {
            epigenetic_mark_name = epigenetic_mark.name;
        } else {
            epigenetic_mark_name = epigenetic_mark;
        }

        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', genome.name);
        params.set('type', 'peaks');
        params.set('epigenetic_mark', epigenetic_mark_name);
        return this.http.get(this.deepBlueUrl + '/list_experiments', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];
                return data.map((value: string[]) => {
                    return new Experiment(value);
                });
            })
            .catch(this.handleError);
    }

    addSelectedBiosource(biosource: BioSource) {
        let bss = this.selectedBioSources.value;

        let found = false;
        for (let bs of bss) {
            if (bs.id.id == biosource.id.id) {
                found = true;
            }
        }

        if (!found) {
            bss.push(biosource.clone());
            this.selectedBioSources.next(bss);
        }
    }


    removeSelectedBiosource(biosource: BioSource) {
        let bs = this.selectedBioSources.value;
        let index = bs.indexOf(biosource);
        if (index >= -1) {
            bs.splice(index, 1);
            this.selectedBioSources.next(bs);
        }
    }

    setSelectedBioSources(biosources: BioSource[]) {
        this.selectedBioSources.next(biosources);
    }

    tilingRegions(size: number, chromosomes: string[], progress_element: ProgressElement, request_count: number): Observable<DeepBlueTiling> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('size', size.toString());
        for (let chromosome of chromosomes) {
            params.set('chromosome', chromosome);
        }
        params.set('genome', this.getGenome().name);
        return this.http.get(this.deepBlueUrl + '/tiling_regions', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueTiling(size, this.getGenome().name, chromosomes, query_id, request_count);
            })
            .catch(this.handleError);
    }


    selectAnnotation(annotation: IdName, progress_element: ProgressElement, request_count: number): Observable<DeepBlueOperation> {
        if (!annotation) {
            return Observable.empty<DeepBlueOperation>();
        }

        if (this.idNamesQueryCache.get(annotation, request_count)) {
            progress_element.increment(request_count);
            const cached_operation = this.idNamesQueryCache.get(annotation, request_count);
            return Observable.of(cached_operation);
        }

        const params: URLSearchParams = new URLSearchParams();
        params.set('annotation_name', annotation.name);
        params.set('genome', this.getGenome().name);
        return this.http.get(this.deepBlueUrl + '/select_annotations', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueOperation(new DeepBlueDataParameter(annotation), query_id, 'select_annotation', request_count);
            })
            .do((operation) => this.idNamesQueryCache.put(annotation, operation))
            .catch(this.handleError);
    }

    selectExperiment(experiment: IdName, progress_element: ProgressElement, request_count: number): Observable<DeepBlueOperation> {
        if (!experiment) {
            return Observable.empty<DeepBlueOperation>();
        }

        if (this.idNamesQueryCache.get(experiment, request_count)) {
            progress_element.increment(request_count);
            const cached_operation = this.idNamesQueryCache.get(experiment, request_count);
            return Observable.of(cached_operation);
        }

        const params: URLSearchParams = new URLSearchParams();
        params.set('experiment_name', experiment.name);
        params.set('genome', this.getGenome().name);
        return this.http.get(this.deepBlueUrl + '/select_experiments', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueOperation(new DeepBlueDataParameter(experiment), query_id, 'select_experiment', request_count);
            })
            .do((operation) => {
                this.idNamesQueryCache.put(experiment, operation);
            })
            .catch(this.handleError);
    }

    selectMultipleExperiments(experiments: IdName[],
        progress_element: ProgressElement, request_count: number): Observable<IOperation[]> {

        const observableBatch: Observable<IOperation>[] = [];

        experiments.forEach((experiment, key) => {
            progress_element.increment(request_count);
            observableBatch.push(this.selectExperiment(experiment, progress_element, request_count));
        });

        return Observable.forkJoin(observableBatch);
    }


    mergeQueries(queries_id: IOperation[], progress_element: ProgressElement, request_count: number): Observable<IOperation> {
        if (!queries_id || queries_id.length == 0) {
            return Observable.empty<DeepBlueOperation>();
        }

        if (queries_id.length == 1) {
            return Observable.of(queries_id[0]);
        }

        const params: URLSearchParams = new URLSearchParams();

        params.append('query_a_id', queries_id[0].queryId().id);

        for (let query_b of queries_id.slice(1)) {
            params.append('query_b_id', query_b.queryId().id);
        }

        return this.http.get(this.deepBlueUrl + '/merge_queries', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueOperation(new DeepBlueDataParameter("Merged queries"), query_id, 'merge_queries', request_count);
            })
            .catch(this.handleError);
    }

    filter_region(data: IOperation, field: string, operation: string,
        value: string, type: string, progress_element: ProgressElement, request_count: number): Observable<IOperation> {


        const parameters = [field, operation, value, type];

        const cache_key = new DeepBlueOperationArgs([data, parameters, 'filter']);

        if (this.filtersQueryCache.get(cache_key, request_count)) {
            progress_element.increment(request_count);
            const cached_operation = this.filtersQueryCache.get(cache_key, request_count);
            return Observable.of(cached_operation);
        }

        const params: URLSearchParams = new URLSearchParams();

        params.set('query_id', data.queryId().id);
        params.set('field', field);
        params.set('operation', operation);
        params.set('value', value);
        params.set('type', type);

        return this.http.get(this.deepBlueUrl + '/filter_regions', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueOperation(data.data(), query_id, 'filter', request_count);
            })
            .do((result_operation) => this.filtersQueryCache.put(cache_key, result_operation))
            .catch(this.handleError);


    }

    intersectWithSelected(current_operations: DeepBlueOperation[], selected_data: DeepBlueOperation[],
        progress_element: ProgressElement, request_count: number): Observable<StackValue[]> {

        const observableBatch: Observable<StackValue>[] = [];

        current_operations.forEach((current, stack_pos) => {
            selected_data.forEach((selected) => {
                let o: Observable<StackValue>;
                const cache_key = [current, selected];

                if (this.intersectsQueryCache.get(cache_key, request_count)) {
                    progress_element.increment(request_count);
                    const cached_operation = this.intersectsQueryCache.get(cache_key, request_count);
                    o = Observable.of(new StackValue(stack_pos, cached_operation));
                } else {
                    const params: URLSearchParams = new URLSearchParams();
                    params.set('query_data_id', current.query_id.id);
                    params.set('query_filter_id', selected.query_id.id);
                    o = this.http.get(this.deepBlueUrl + '/intersection', { 'search': params })
                        .map((res: Response) => {
                            const body = res.json();
                            const response: string = body[1] || '';
                            const query_id = new Id(response);
                            progress_element.increment(request_count);
                            return new StackValue(stack_pos, new DeepBlueOperation(selected.data(), query_id, 'intersection', request_count));
                        })
                        .do((operation: StackValue) => this.intersectsQueryCache.put(cache_key, operation.getDeepBlueOperation()))
                        .catch(this.handleError);
                }
                observableBatch.push(o);
            });
        });

        return Observable.forkJoin(observableBatch);
    }

    overlap(data_one: IOperation, data_two: IOperation,
        overlap: string, progress_element: ProgressElement, request_count: number): Observable<DeepBlueOperation> {

        const amount = '1';
        const amount_type = 'bp';

        const parameters = [overlap, amount, amount_type];

        const cache_key = new DeepBlueOperationArgs([data_one, data_two, parameters, 'overlap']);

        if (this.overlapsQueryCache.get(cache_key, request_count)) {
            progress_element.increment(request_count);
            const cached_operation = this.overlapsQueryCache.get(cache_key, request_count);
            return Observable.of(cached_operation);
        }

        const params: URLSearchParams = new URLSearchParams();

        // overlap ( query_data_id, query_filter_id, overlap, amount, amount_type, user_key )
        params.set('query_data_id', data_one.queryId().id);
        params.set('query_filter_id', data_two.queryId().id);
        params.set('overlap', overlap);
        params.set('amount', '1'); // TODO:  receive this parameter
        params.set('amount_type', 'bp'); // TODO:  receive this parameter

        return this.http.get(this.deepBlueUrl + '/overlap', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueOperation(data_one.data(), query_id, 'overlap', request_count);
            })
            .do((operation) => this.overlapsQueryCache.put(cache_key, operation))
            .catch(this.handleError);
    }

    findMotif(dna_motif: string, progress_element: ProgressElement, request_count: number): Observable<DeepBlueOperation> {
        if (!dna_motif) {
            return Observable.empty<DeepBlueOperation>();
        }

        const params: URLSearchParams = new URLSearchParams();

        params.set('motif', dna_motif);
        params.set('genome', this.getGenome().name);

        return this.http.get(this.deepBlueUrl + '/find_motif', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return new DeepBlueOperation(new DeepBlueDataParameter(dna_motif), query_id, 'find_motif', request_count);
            })
            .catch(this.handleError);

    }


    cacheQuery(selected_data: IOperation, progress_element: ProgressElement, request_count: number): Observable<IOperation> {
        if (!selected_data) {
            return Observable.empty<DeepBlueOperation>();
        }

        if (this.operationCache.get(selected_data, request_count)) {
            progress_element.increment(request_count);
            const cached_operation = this.operationCache.get(selected_data, request_count);
            return Observable.of(cached_operation);
        }

        const params: URLSearchParams = new URLSearchParams();
        params.set('query_id', selected_data.queryId().id);
        params.set('cache', 'true');
        return this.http.get(this.deepBlueUrl + '/query_cache', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(response);
                progress_element.increment(request_count);
                return selected_data.cacheIt(query_id);
            })
            .do((operation) => this.operationCache.put(selected_data, operation))
            .catch(this.handleError);
    }


    getResult(op_request: DeepBlueRequest, progress_element: ProgressElement, request_count: number): Observable<DeepBlueResult> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('request_id', op_request.id().id);

        const pollSubject = new Subject<DeepBlueResult>();

        if (this.resultCache.get(op_request, request_count)) {
            progress_element.increment(request_count);
            const cached_result = this.resultCache.get(op_request, request_count);
            return Observable.of(cached_result);
        }

        const pollData = this.http.get(this.deepBlueUrl + '/get_request_data', { 'search': params })
            .map((res: Response) => {
                console.log('polling...');
                const body = res.json();
                const status = body[0] || 'error';
                if (status === 'okay') {
                    progress_element.increment(request_count);
                    const op_result = new DeepBlueResult(op_request, body[1], request_count);
                    this.resultCache.put(op_request, op_result);
                    expand.unsubscribe();
                    pollSubject.next(op_result);
                    pollSubject.complete();
                }
            });

        const expand = pollData.expand(
            () => Observable.timer(250).concatMap(() => pollData)
        ).subscribe();

        return pollSubject.asObservable();
    }

    countRegionsRequest(op_exp: IOperation, progress_element: ProgressElement, request_count: number): Observable<DeepBlueResult> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('query_id', op_exp.queryId().id);

        if (this.requestCache.get(op_exp, request_count)) {
            progress_element.increment(request_count);
            const cached_result = this.requestCache.get(op_exp, request_count);
            return this.getResult(cached_result, progress_element, request_count);

        } else {
            const request: Observable<DeepBlueResult> = this.http.get(this.deepBlueUrl + '/count_regions', { 'search': params })
                .map((res: Response) => {
                    const body = res.json();
                    const request_id = new Id(body[1]);
                    progress_element.increment(request_count);
                    const deepblue_request = new DeepBlueRequest(op_exp, request_id, 'count_regions', request_count);
                    this.requestCache.put(op_exp, deepblue_request);
                    return deepblue_request;
                })
                .flatMap((request_id) => {
                    return this.getResult(request_id, progress_element, request_count);
                });

            return request;
        }
    }


    getRegions(data: IOperation, format: string,
        progress_element: ProgressElement, request_count: number): Observable<DeepBlueResult> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('query_id', data.queryId().id);
        params.set('output_format', format);

        const request: Observable<DeepBlueResult> = this.http.get(this.deepBlueUrl + '/get_regions', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const request_id = new Id(body[1]);
                progress_element.increment(request_count);
                const deepblue_request = new DeepBlueRequest(data, request_id, 'get_regions', request_count);
                return deepblue_request;
            })
            .flatMap((deepblue_request) => {
                return this.getResult(deepblue_request, progress_element, request_count);
            });

        return request;
    }

    getResultBatch(op_requests: DeepBlueRequest[], progress_element: ProgressElement, request_count: number): Observable<DeepBlueResult[]> {
        const observableBatch: Observable<DeepBlueResult>[] = [];

        op_requests.forEach((op_request, key) => {
            const o: Observable<DeepBlueResult> = this.getResult(op_request, progress_element, request_count);
            observableBatch.push(o);
        });

        return Observable.forkJoin(observableBatch);

    }

    countRegionsBatch(query_ids: StackValue[], progress_element: ProgressElement, request_count: number): Observable<StackValue[]> {
        const observableBatch: Observable<StackValue>[] = [];

        query_ids.forEach((op_exp, key) => {
            const o: Observable<StackValue> = new Observable((observer) => {
                this.countRegionsRequest(op_exp.getDeepBlueOperation(), progress_element, request_count).subscribe((result) => {
                    observer.next(new StackValue(op_exp.stack, result));
                    observer.complete();
                });
            });

            observableBatch.push(o);
        });

        return Observable.forkJoin(observableBatch);

    }

    private extractId(res: Response) {
        const body = res.json();
        return body[1] || '';
    }

    getExperimentsInfos(ids: string[]): Observable<FullExperiment[]> {
        const params: URLSearchParams = new URLSearchParams();
        for (const id of ids) {
            params.append('id', id);
        }

        return this.http.get(this.deepBlueUrl + '/info', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];
                return data.map((value: any) => {
                    return new FullExperiment(value);
                });
            })
            .catch(this.handleError);
    }

    getInfo(id: Id): Observable<FullMetadata> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('id', id.id);
        return this.http.get(this.deepBlueUrl + '/info', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];

                if (id.id[0] === 'e') {
                    return new FullExperiment(data[0]);
                } else if (id.id[0] === 'a') {
                    return new FullAnnotation(data[0]);
                } else if (id.id[0] === 'g' && id.id[1] === 's') {
                    return new FullGeneModel(data[0]);
                } else {
                    console.log('UNKNOW TYPE: ' + id);
                    return new FullExperiment(data[0]);
                }

            }).catch(this.handleError);
    }


    getGeneModelsInfo(ids: string[]): Observable<FullGeneModel[]> {
        const params: URLSearchParams = new URLSearchParams();
        for (const id of ids) {
            params.append('id', id);
        }

        return this.http.get(this.deepBlueUrl + '/info', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];
                return data.map((value: any) => {
                    return new FullGeneModel(value);
                });
            })
            .catch(this.handleError);
    }

    getGeneModels(): Observable<GeneModel[]> {
        return this.http.get(this.deepBlueUrl + '/list_gene_models')
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];
                return data.map((value: string[]) => {
                    return new GeneModel(value);
                });
            })
            .catch(this.handleError);
    }

    getGeneModelsBySelectedGenome(): Observable<GeneModel[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        return this.http.get(this.deepBlueUrl + '/composed_commands/gene_models_by_genome', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const data = body[1] || [];
                return data.map((value: any) => {
                    return new FullGeneModel(value['values']);
                });
            })
            .catch(this.handleError);
    }

    selectGenes(genes: string[], gene_model: IdName, progress_element: ProgressElement, request_count: number): Observable<DeepBlueOperation> {
        if (!gene_model) {
            return Observable.empty<DeepBlueOperation>();
        }

        const params: URLSearchParams = new URLSearchParams();
        params.set('gene_model', gene_model.name);

        for (let name of genes) {
            params.set('genes', name);
        }

        return this.http.get(this.deepBlueUrl + '/select_genes', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(body[1]);
                progress_element.increment(request_count);
                return new DeepBlueOperation(new DeepBlueOperationArgs({ genes: genes, gene_model: gene_model }), query_id, 'select_genes', request_count);
            })
            .catch(this.handleError);
    }

    inputRegions(region_set: string, progress_element: ProgressElement, request_count: number): Observable<DeepBlueOperation> {
        if (!region_set) {
            return Observable.empty<DeepBlueOperation>();
        }

        var headers = new Headers();
        headers.append('Content-Type', 'application/json');

        let request = {
            "genome": this.getGenome().name,
            "region_set": region_set
        }

        return this.http.post(this.deepBlueUrl + '/composed_commands/input_regions', request, { headers: headers })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                const query_id = new Id(body[1]);
                progress_element.increment(request_count);
                return new DeepBlueOperation(new DeepBlueDataParameter("User Data"), query_id, 'input_regions', -1)
            });
    }

    private handleError(error: Response | any) {
        let errMsg: string;
        if (error instanceof Response) {
            const body = error.json() || '';
            const err = body.error || JSON.stringify(body);
            errMsg = "${err.status} - ${err.statusText || ''} ${err}";
        } else {
            errMsg = error.message ? error.message : error.toString();
        }
        console.log(errMsg);
        return Observable.throw(errMsg);
    }

    public composedOverlapEnrichmentDatabase(gene_model: GeneModel): Observable<[string, string[]][]> {
        const params: URLSearchParams = new URLSearchParams();
        params.append('genome', gene_model.name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/get_enrichment_databases', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: [string, string[]][] = body || '';
                return response;
            });
    }

    public composedCountOverlaps(queries: IOperation[], experiments: IdName[], filters?: FilterParameter[]): Observable<DeepBlueMiddlewareRequest> {
        const params: URLSearchParams = new URLSearchParams();
        for (const query_op_id of queries) {
            params.append('queries_id', query_op_id.queryId().id);
        }

        for (const exp of experiments) {
            params.append('experiments_id', exp.id.id);
        }

        if (filters) {
            params.append("filters", JSON.stringify(filters));
        }

        params.rawParams

        return this.http.get(this.deepBlueUrl + '/composed_commands/count_overlaps', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                return new DeepBlueMiddlewareRequest(params.paramsMap, "count_overlaps", new Id(response));;
            });
    }

    public composedCountGenesOverlaps(queries: IOperation[], gene_model: GeneModel): Observable<DeepBlueMiddlewareRequest> {
        const params: URLSearchParams = new URLSearchParams();
        for (const query_op_id of queries) {
            params.append('queries_id', query_op_id.queryId().id);
        }
        params.append('gene_model_name', gene_model.name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/count_genes_overlaps', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                return new DeepBlueMiddlewareRequest(params.paramsMap, "count_genes_overlaps", new Id(response));
            });
    }

    public composedCalculateGenesEnrichment(queries: IOperation[], gene_model: GeneModel): Observable<DeepBlueMiddlewareRequest> {
        const params: URLSearchParams = new URLSearchParams();
        for (const query_op_id of queries) {
            params.append('queries_id', query_op_id.queryId().id);
        }
        params.append('gene_model_name', gene_model.name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/enrich_regions_go_terms', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                return new DeepBlueMiddlewareRequest(params.paramsMap, "enrich_regions_go_terms", new Id(response));
            });
    }

    public composedCalculateOverlapsEnrichment(queries: IOperation[], universe_id: Id, datasets: Object): Observable<DeepBlueMiddlewareRequest> {
        var headers = new Headers();
        headers.append('Content-Type', 'application/json');

        let request : { [key: string]: any } = {
            "queries_id": queries.map((op) => op.queryId().id),
            "universe_id": universe_id.id,
            "genome": this.genomeSource.getValue().name,
            "datasets": datasets
        }

        let request_map = new Map<string, any>();
        for (let key of Object.keys(request)) {
            request_map.set(key, request[key]);
        }

        return this.http.post(this.deepBlueUrl + '/composed_commands/enrich_regions_overlap', request, { headers: headers })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                return new DeepBlueMiddlewareRequest(request_map, "enrich_regions_overlap", new Id(response));
            });
    }

    public composedCalculateFastsEnrichment(op: IOperation): Observable<DeepBlueMiddlewareRequest> {
        var headers = new Headers();
        headers.append('Content-Type', 'application/json');

        let request : { [key: string]: any } = {
            "query_id": op.queryId().id,
            "genome": this.genomeSource.getValue().name
        }

        let request_map = new Map<string, any>();
        for (let key of Object.keys(request)) {
            request_map.set(key, request[key]);
        }

        return this.http.post(this.deepBlueUrl + '/composed_commands/enrich_regions_fast', request, { headers: headers })
            .map((res: Response) => {
                const body = res.json();
                const response: string = body[1] || '';
                return new DeepBlueMiddlewareRequest(request_map, "enrich_regions_fast", new Id(response));
            });
    }

    composedCancel(request: AbstractDeepBlueRequest): Observable<string[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.append('id', request.id().id);

        return this.http.get(this.deepBlueUrl + '/composed_commands/cancel', { 'search': params })
            .map((res: Response) => {
                return res.json();
            })
            .catch(this.handleError);
    }

    public getComposedResult(request: DeepBlueMiddlewareRequest): Observable<[string, string | DeepBlueMiddlewareOverlapResult[]]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('request_id', request.requestId().id);

        return this.http.get(this.deepBlueUrl + '/composed_commands/get_request', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                const response: [string, string | DeepBlueMiddlewareOverlapResult[]] = body;
                return response;
            });
    }


    // TODO: Move the logic of converting the data to the function callers
    public getComposedResultIterator(request: DeepBlueMiddlewareRequest, progress_element: ProgressElement, request_type: string, callback?: any, param?: any):
        Observable<DeepBlueMiddlewareOverlapResult[] | DeepBlueMiddlewareGOEnrichtmentResult[] | DeepBlueMiddlewareOverlapEnrichtmentResultItem[] | DeepBlueMiddlewareOverlapEnrichtmentResult[]> {
        const pollSubject = new Subject<DeepBlueMiddlewareOverlapResult[] | DeepBlueMiddlewareGOEnrichtmentResult[] | DeepBlueMiddlewareOverlapEnrichtmentResultItem[] | DeepBlueMiddlewareOverlapEnrichtmentResult[]>();

        const timer = Observable.timer(0, 1000).concatMap(() => {

            if (request.isCanceled()) {
                timer.unsubscribe();
                return null;
            }

            return this.getComposedResult(request).map((data: [string, string | DeepBlueMiddlewareOverlapResult[]]) => {
                if (data[0] === 'okay') {
                    timer.unsubscribe();
                    if (request_type === 'overlaps') {
                        pollSubject.next(
                            (<Object[]>(data[1])).map((ee) => DeepBlueMiddlewareOverlapResult.fromObject(ee))
                        );
                    } else if (request_type === 'go_enrichment') {
                        pollSubject.next(
                            (<Object[]>(data[1])).map((ee) => DeepBlueMiddlewareGOEnrichtmentResult.fromObject(ee))
                        );
                    } else if (request_type === 'overlaps_enrichment_fast') {
                        pollSubject.next(
                            (<Object[]>(data[1])).map((ee) => DeepBlueMiddlewareOverlapEnrichtmentResultItem.fromObject(ee))
                        );
                    } else if (request_type === 'overlaps_enrichment') {
                        pollSubject.next(
                            (<Object[]>(data[1])).map((ee) => DeepBlueMiddlewareOverlapEnrichtmentResult.fromObject(ee))
                        );
                    }
                    pollSubject.complete();
                    progress_element.finish();
                } else {

                    let status: any = data[1];
                    let partial: any[] = status["partial"];

                    if (partial && callback) {
                        if (request_type === 'overlaps') {
                            partial = (<Object[]>(partial)).map((ee) => DeepBlueMiddlewareOverlapResult.fromObject(ee));
                        } else if (request_type === 'go_enrichment') {
                            partial = (<Object[]>(partial)).map((ee) => DeepBlueMiddlewareGOEnrichtmentResult.fromObject(ee))
                        } else if (request_type === 'overlaps_enrichment_fast') {
                            partial = (<Object[]>(partial)).map((ee) => DeepBlueMiddlewareOverlapEnrichtmentResultItem.fromObject(ee))
                        } else if (request_type === 'overlaps_enrichment') {
                            partial = (<Object[]>(partial)).map((ee) => DeepBlueMiddlewareOverlapEnrichtmentResult.fromObject(ee))
                        }

                        if (partial) {
                            pollSubject.next(partial);
                            callback(param, partial);
                        }
                    }
                    progress_element.setStatus(status['step'], status['processed'], status['total']);
                }
            });
        }).subscribe();

        return pollSubject;
    }

    public getComposedListGenes(gene_model: string, gene_id_name: string): Observable<Gene[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('gene_model', gene_model);
        params.set('gene_id_name', gene_id_name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/list_genes', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                return body;
            });
    }


    public getComposedEnrichmentDatabases(genome: string): Observable<[string, string[]][]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', genome);

        return this.http.get(this.deepBlueUrl + '/composed_commands/get_enrichment_databases', { 'search': params })
            .map((res: Response) => {
                const body = res.json();
                return body;
            });
    }

    public getComposedEpigeneticMarksCategories(): Observable<string[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/get_epigenetic_marks_categories', { 'search': params })
            .map((res: Response) => res.json());
    }

    public getComposedEpigeneticMarksFromCategory(category: string): Observable<FullMetadata[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('category', category);
        params.set('genome', this.getGenome().name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/get_epigenetic_marks_from_category', { 'search': params })
            .map(this.extractFullMetadata)
            .catch(this.handleError);
    }

    public getRelatedBioSources(biosource: BioSource): Observable<string[]> {
        const params: URLSearchParams = new URLSearchParams();
        params.set('biosource', biosource.name);
        params.set('genome', this.getGenome().name);

        return this.http.get(this.deepBlueUrl + '/composed_commands/get_related_biosources', { 'search': params })
            .map((res: Response) => res.json())
            .catch(this.handleError);
    }


}
