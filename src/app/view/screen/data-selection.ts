import { Component, OnInit, ViewChild } from '@angular/core';
import { DeepBlueService } from "app/service/deepblue";
import { IOperation } from 'app/domain/interfaces';
import { Router } from '@angular/router';

@Component({
    templateUrl: './data-selection.html'
})
export class DataSelectionScreen {

    constructor(private deepBlueService: DeepBlueService, private router: Router) { }

    visibleSidebar2 = false;

    selectQuery(event: IOperation) {
        this.deepBlueService.setDataToDive(event);
        this.router.navigate(['/go_enrichment']);
    }
}
