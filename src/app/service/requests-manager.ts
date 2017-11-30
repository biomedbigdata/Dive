import { DeepBlueRequest, AbstractDeepBlueRequest } from "app/domain/operations";
import { request } from "http";
import { Injectable } from "@angular/core";
import { DeepBlueService } from "app/service/deepblue";
import { Router, NavigationStart } from "@angular/router";


@Injectable()
export class RequestManager {

  requests = new Array<AbstractDeepBlueRequest>();

  constructor(private deepBlueService: DeepBlueService, private router: Router) {
    router.events.subscribe((val) => {
      if (val instanceof NavigationStart) {
        this.cancelAllRequest();
      }
      console.log(val)
    });
  }

  enqueueRequest(request: AbstractDeepBlueRequest) {
    this.requests.push(request);
  }

  cancelAllRequest() {
    for (let request of this.requests) {
      request.cancel();
      this.deepBlueService.composedCancel(request).subscribe((id) => console.log(id));
    }
    this.requests = [];
  }
}