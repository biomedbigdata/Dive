import { FormGroup, FormControl, FormBuilder, Validators } from '@angular/forms';

import { Subscription } from 'rxjs/Subscription';

import { SelectedData } from 'app/service/selected-data';

import {
    SimpleChanges,
    Component,
    ViewChild,
    OnChanges,
    OnInit,
    Input
} from '@angular/core';

import { Annotation } from 'app/domain/deepblue';
import { DeepBlueService } from 'app/service/deepblue';
import { DiveMenuService } from 'app/service/menu';

@Component({
    selector: 'length-filtering',
    template: '<p></p>'
})
export class LengthMenuFilterComponent implements OnInit {

    public min_length_form: FormGroup;
    public max_length_form: FormGroup;

    constructor(private deepBlueService: DeepBlueService, private fb: FormBuilder,
        private selectedData: SelectedData, private diveMenuService: DiveMenuService) {
    }

    validateMinNumber(c: FormControl) {
        return c.value < 1 ? null : { valid: false }
    };

    save_min_length(form_content: any) {
        event.preventDefault();
        this.selectedData.activeStackSubject.getValue().filter_regions('@LENGTH', '>=', form_content['min_length'], 'number');
    }

    save_max_length(form_content: any) {
        event.preventDefault();
        this.selectedData.activeStackSubject.getValue().filter_regions('@LENGTH', '<=', form_content['max_length'], 'number');
    }

    ngOnInit() {
        this.min_length_form = this.fb.group({
            min_length: [0, [this.validateMinNumber]]
        });

        this.max_length_form = this.fb.group({
            max_length: [0, []]
        });

        this.deepBlueService.dataToDiveValue$.subscribe(data => {
            if (data === null) {
                return;
            }

            this.diveMenuService.includeObject('filtering',
                {
                    label: 'Mininum region length', type: 'number', group: this.min_length_form, control_name: 'min_length',
                    submit: (event: any) => { this.save_min_length(this.min_length_form.value); }
                });

            this.diveMenuService.includeObject('filtering',
                {
                    label: 'Maximum region length', type: 'number', group: this.max_length_form, control_name: 'max_length',
                    submit: (event: any) => { this.save_max_length(this.max_length_form.value); }
                });
        })
    }

}
