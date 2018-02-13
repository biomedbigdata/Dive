import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subject } from 'rxjs/Subject';

import { Annotation, Id, FullMetadata } from 'app/domain/deepblue';

import { DeepBlueOperation, DeepBlueDataParameter } from 'app/domain/operations'

import { DeepBlueService } from 'app/service/deepblue';
import { DataStack, DataStackFactory, DataStackItem } from 'app/service/datastack';
import { IOperation } from 'app/domain/interfaces';

@Injectable()
export class SelectedData implements OnDestroy {

  _stacks: DataStack[] = [];

  currentStackSubscription: Subscription = null;

  public activeStackSubject = new BehaviorSubject<DataStack>(null);
  public activeStackValue$: Observable<DataStack> = this.activeStackSubject.asObservable();

  public activeTopStackSubject = new BehaviorSubject<DataStackItem>(null);
  public activeTopStackValue$: Observable<DataStackItem> = this.activeTopStackSubject.asObservable();

  annotationSubscription: Subscription;

  constructor(private deepBlueService: DeepBlueService, private dataStackFactory: DataStackFactory) {
    this.annotationSubscription = deepBlueService.dataToDiveValue$.subscribe((op: IOperation) => {
      const stack: DataStack = dataStackFactory.newDataStack();
      if (op !== null) {
        // TODO: Ask if the user want to save the previous stack
        stack.setInitialData(op);
        this.replaceStack(0, stack);
        this.setActiveStack(stack);
      }
    });
  }

  ngOnDestroy() {
    this.annotationSubscription.unsubscribe();
  }

  insertForComparison(comparisonData: IOperation) {
    const stack: DataStack = this.dataStackFactory.newDataStack();
    stack.setInitialData(comparisonData);
    this.insertStack(1, stack);
  }

  insertStack(position: number, stack: DataStack) {
    this._stacks.splice(position, 0, stack);
  }

  replaceStack(position: number, stack: DataStack) {
    this._stacks[position] = stack;
  }

  setActiveStack(stack: DataStack) {
    const index = this._stacks.indexOf(stack);
    if (index <= -1) {
      console.warn("(setActiveStack)", stack, 'not found');
      return;
    }

    const toChange = this._stacks[index];
    this._stacks[index] = this._stacks[0];
    this._stacks[0] = toChange;


    if (this.currentStackSubscription != null && !this.currentStackSubscription.closed) {
      this.currentStackSubscription.unsubscribe();
    }
    this.currentStackSubscription = stack.getTopStackValueObserver().subscribe((dataStackItem: DataStackItem) =>
      this.activeTopStackSubject.next(dataStackItem)
    )

    this.activeStackSubject.next(stack);
  }

  removeStack(stack: DataStack): DataStack {
    const index = this._stacks.indexOf(stack, 0);
    if (index > -1) {
      const removedStack = this._stacks[index];
      this._stacks.splice(index, 1);
      if (this.activeStackSubject.getValue() === removedStack) {
        // TODO: set the next one as active.
        this.activeStackSubject.next(this.dataStackFactory.newDataStack());
      }
      return removedStack;
    }
    return null;
  }

  getActiveData(): DataStackItem[] {
    if (this.activeStackSubject.getValue() != null) {
      return this.activeStackSubject.getValue().getData();
    }
    return [];
  }

  getActiveCurrentOperation(): IOperation {
    if (this.activeStackSubject.getValue() != null) {
      return this.activeStackSubject.getValue().getCurrentOperation();
    }
    return null;
  }

  getActiveCurrentOperationMetadata(): Observable<FullMetadata> {
    let currentOp = this.getActiveCurrentOperation();
    if (currentOp != null && currentOp.mainOperation().data().dataType() != "empty_parameter") {
      let param = <DeepBlueDataParameter>currentOp.mainOperation().data()
      return this.deepBlueService.getInfo(param.id());
    }
    return Observable.of(null);
  }

  getStacksTopOperation(): IOperation[] {
    return this._stacks.map((stack: DataStack) => stack.getCurrentOperation());
  }

  getStackPosByQueryId(query_id: Id): number {
    return this.getStacksTopOperation()
      .map((stack: DeepBlueOperation) => stack.query_id.id)
      .indexOf(query_id.id);
  }

  getStackname(pos: number): string {
    return this._stacks[pos].name();
  }

  saveActiveStack() {
    const clone = this.activeStackSubject.getValue().cloneStackItems();
    const stack: DataStack = this.dataStackFactory.newDataStack();
    stack.setInitialDataArray(clone);
    this.insertStack(1, stack);
  }

  getStackName(pos: number) {
    if (pos >= this._stacks.length) {
      return 'Invalid Stack';
    }

    return this._stacks[pos].name();
  }

  getStackColor(pos: number, alpha: string) {
    if (pos >= this._stacks.length) {
      return '#FFFFFF';
    }

    return this._stacks[pos].getColor(alpha);
  }

}
