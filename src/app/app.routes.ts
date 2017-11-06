import { GoEnrichmentScreenComponent } from './view/screen/go_enrichment';
import { Routes, RouterModule } from '@angular/router';
import { ModuleWithProviders } from '@angular/core';
import { DataSelectionScreen } from 'app/view/screen/data-selection';
import { RegionsScreen } from 'app/view/screen/regions';
import { HistonesScreenComponent } from 'app/view/screen/histones';
import { ChromatinStatesScreenComponent } from 'app/view/screen/chromatin_states';
import { GenesScreen } from 'app/view/screen/genes';
import { OverlapEnrichmentScreenComponent } from "app/view/screen/overlap_enrichment";
import { PeaksOverlapScreenComponent } from 'app/view/screen/peaks-overlap';

export const routes: Routes = [
    { path: '', component: DataSelectionScreen },
    { path: 'regions', component: RegionsScreen },
    { path: 'histonemark', component: HistonesScreenComponent },
    { path: 'genes', component: GenesScreen },
    { path: 'go_enrichment', component: GoEnrichmentScreenComponent },
    { path: 'chromatin_states', component: ChromatinStatesScreenComponent },
    { path: 'overlap_enrichment', component: OverlapEnrichmentScreenComponent },
    { path: 'peaks_overlap', component: PeaksOverlapScreenComponent }
];

export const AppRoutes: ModuleWithProviders = RouterModule.forRoot(routes);
