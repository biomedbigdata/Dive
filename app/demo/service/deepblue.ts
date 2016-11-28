import { Injectable }     from '@angular/core';
import { Http,
         Response, 
         URLSearchParams } from '@angular/http';

import { BehaviorSubject }    from 'rxjs/BehaviorSubject';

import { Observable }     from 'rxjs/Observable'

import { Subject }     from 'rxjs/Subject'

import { IdName,
         EpigeneticMark, 
         Genome, 
         Annotation }     from '../domain/deepblue';


@Injectable()
export class DeepBlueService {
    private deepBlueUrl = 'api';

    // Observable string sources
    public genomeSource = 
        new BehaviorSubject<Genome>({id: "-", name: "-", extra_metadata: null});
    public annotationSource = 
        new BehaviorSubject<Annotation>({id: "-", name: "-", extra_metadata: null});
    public epigeneticMarkSource = 
        new BehaviorSubject<EpigeneticMark>({id: "-", name: "-", extra_metadata: null});        


    totalSelectedRegtions : Number = 0;            

    // Observable string streams
    genomeValue$: Observable<Genome> = this.genomeSource.asObservable();
    annotationValue$: Observable<Annotation> = this.annotationSource.asObservable();
    epigeneticMarkValue$: Observable<EpigeneticMark> = this.epigeneticMarkSource.asObservable();


    getTotalSelectedRegtions() : Number {
        return this.totalSelectedRegtions;
    }

    // Service messages
    setGenome(genome: Genome) {
        this.genomeSource.next(genome);
    }

    setAnnotation(annotation: Annotation) {
        this.annotationSource.next(annotation);

        this.selectAnnotation(annotation).subscribe((query_id) => 
            this.countRegionsRequest(query_id).subscribe((total) =>
                this.totalSelectedRegtions = total["count"]
            )
        ); 
    }

    setEpigeneticMark(epigeneticMark: EpigeneticMark) {
        this.epigeneticMarkSource.next(epigeneticMark);
    }

    getGenome(): Genome {
        return this.genomeSource.getValue();
    }

    getAnnotation(): Annotation {
        return this.annotationSource.getValue();
    }


    getEpigeneticMark(): EpigeneticMark {
        return this.epigeneticMarkSource.getValue();
    }

    // 

    constructor (private http: Http) { }

    // Functions to select data from the Server


    getHistones() : Observable<EpigeneticMark[]> {
        if (!this.getGenome()) {
            return Observable.empty<EpigeneticMark[]>();
        }
        let params: URLSearchParams = new URLSearchParams();
        params.set('genome', this.getGenome().name);
        params.set('controlled_vocabulary', "epigenetic_marks");
        params.set('type', "peaks");
        return this.http.get(this.deepBlueUrl + "/collection_experiments_count", {"search": params})        
            .map(this.extractHistone)
            .catch(this.handleError);
    }

    private extractHistone( res: Response) {
        let body = res.json();
        var data =  body[1] || [] ;
        var regexp = new RegExp("h([134]|2[ab])([a-z])([0-9]+)(.*)");
        
        data = data.filter((em) => {
            // em[1] is where the name is
            return regexp.test(em[1].toLowerCase());
        }).sort((em1, em2) => {
            return em1[1].localeCompare(em2[1]);
        });;

        return data.map((value) => {
            return (new EpigeneticMark(value));
        });
    }

    getGenomes() : Observable<Genome[]> {
        return this.http.get(this.deepBlueUrl + "/list_genomes")
            .map(this.extractGenomes)
            .catch(this.handleError);
    }

    private extractGenomes( res: Response) {
        let body = res.json();
        var data =  body[1] || [] ;
        return data.map((value) => {
            return new Genome(value);
        });
    }
        
    getAnnotations(genome) : Observable<Annotation[]> {
        if (!genome) {
            return Observable.empty<Annotation[]>();
        }
        let params: URLSearchParams = new URLSearchParams();
        params.set('genome', genome.name);
        return this.http.get(this.deepBlueUrl + "/list_annotations", {"search": params})
            .map(this.extractAnnotation)
            .catch(this.handleError);
    }

    private extractAnnotation( res: Response) {
        let body = res.json();
        var data =  body[1] || [] ;
        return data.map((value) => {
            return new Annotation(value);
        });
    }

    getExperiments(genome, epigenetic_mark) : Observable<IdName[]> {
        if (!genome) {
            return Observable.empty<IdName[]>();
        }

        if (!epigenetic_mark) {
            return Observable.empty<IdName[]>();
        }

        let params: URLSearchParams = new URLSearchParams();
        params.set('genome', genome.name);
        params.set('type', "peaks");
        params.set('epigenetic_mark', epigenetic_mark.name);
        return this.http.get(this.deepBlueUrl + "/list_experiments", {"search": params})
            .map(this.extractIdName)
            .catch(this.handleError);        
    }

    
    selectAnnotation(annotation) : Observable<string> {
        if (!annotation) {
            return Observable.empty<string>();
        }        

        let params: URLSearchParams = new URLSearchParams();
        params.set("annotation_name", annotation.name);
        params.set("genome", this.getGenome().name);
        return this.http.get(this.deepBlueUrl + "/select_annotations", {"search": params})
            .map(this.extractId)
            .catch(this.handleError);
    }


    getResult(request_id) : Observable<any> {
        let params: URLSearchParams = new URLSearchParams();
        params.set("request_id", request_id);
        
        var pollSubject = new Subject<any>();

        var pollData = this.http.get(this.deepBlueUrl + "/get_request_data", {"search" : params})
                    .map((res: Response) => {
                        let body = res.json();
                        var status = body[0] || "error"
                        if (status == "okay") {
                            expand.unsubscribe();
                            pollSubject.next(body[1]);
                        }                                     
                    });

        var expand = pollData.expand( 
            () => Observable.timer(500).concatMap(() => pollData)            
        ).subscribe();

        return pollSubject.asObservable();
    
    }

    countRegionsRequest(query_id) : Observable<string> {
        let params: URLSearchParams = new URLSearchParams();
        params.set("query_id", query_id);

        var request : Observable<string> = 
            this.http.get(this.deepBlueUrl + "/count_regions", {"search": params})
            .map(this.extractId)
            .flatMap((request_id) => {
                return this.getResult(request_id);        
            })

        return request;
    }

    private extractId( res: Response) {
        let body = res.json();
        return body[1] || "" ;
    }


    private extractIdName( res: Response) {
        let body = res.json();
        var data =  body[1] || [] ;
        return data.map((value) => {
            return new IdName(value);
        });
    }

    getInfos(ids: string[]) : Observable<Object[]> {
        let params: URLSearchParams = new URLSearchParams();
        for (let id of ids) {
            params.append('id', id);
        }
     
        return this.http.get(this.deepBlueUrl + "/info", {"search": params})
            .map(this.extractExperiment)
            .catch(this.handleError);
    }

    private extractExperiment( res: Response ) : Object[] {
        let body = res.json();
        var data = body[1] || [];

        return data as Object[];
    }

    private handleError (error: Response | any ) {
        let errMsg : string;
        if (error instanceof Response) {
            const body = error.json() || '';
            const err = body.error || JSON.stringify(body);
            errMsg = `${err.status} - ${ err.statusText || ''} ${err}`
        } else {
            errMsg = error.message ? error.message : error.toString();
        }
        console.log(errMsg);
        return Observable.throw(errMsg);
    }
}


/***
 * 
 * 
 * Rx.Observable.forkJoin can do this.

First import Obserable:

import {Observable} from 'rxjs/Observable';
Now join all observables with forkJoin:

// a set of customer IDs was given to retrieve
var ids:number[] = [1, 4, 7];

// map them into a array of observables and forkJoin
Observable.forkJoin(
    ids.map(
        i => this.http.get('/customers/' + i)
            .map(res => res.json())
    ))
    .subscribe(customers => this.customers = customers);
 * 
 * 
 */