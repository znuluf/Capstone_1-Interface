import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, inject } from '@angular/core';

/**
 * Map pin for a farm's location (DEC-78). Click the map or drag the pin to set latitude and longitude.
 *
 * Free services only:
 * - Map library: Leaflet 1.9.4, loaded from the unpkg CDN the first time a map is shown (no npm package).
 * - Map tiles: OpenStreetMap standard tiles (attribution required, light use only).
 * - Address search: OpenStreetMap Nominatim (one search per button press; no key).
 *
 * Usage: <fpms-location-picker [(lat)]="model.latitude" [(lng)]="model.longitude" [address]="fullAddress"></fpms-location-picker>
 */
@Component({
    selector: 'fpms-location-picker',
    standalone: true,
    template: `
        @if (!readonly) {
            <div class="d-flex flex-wrap mb-2">
                @if (address) {
                    <button type="button" class="btn btn-sm btn-default mr-2 mb-1" [disabled]="busy" (click)="findAddress()">
                        <i class="fas fa-search-location mr-1" aria-hidden="true"></i>Find address on map
                    </button>
                }
                <button type="button" class="btn btn-sm btn-default mr-2 mb-1" [disabled]="busy" (click)="useMyLocation()">
                    <i class="fas fa-crosshairs mr-1" aria-hidden="true"></i>Use my location
                </button>
                @if (hasPin) {
                    <button type="button" class="btn btn-sm btn-default mb-1" (click)="clear()">
                        <i class="fas fa-times mr-1" aria-hidden="true"></i>Remove pin
                    </button>
                }
            </div>
        }
        <div #mapEl class="fpms-location-map" role="application" aria-label="Map of the farm location"></div>
        @if (loadFailed) {
            <small class="text-danger d-block mt-1">The map could not load (no internet connection?). You can still type the coordinates.</small>
        } @else if (message) {
            <small class="text-muted d-block mt-1">{{ message }}</small>
        } @else if (!readonly) {
            <small class="text-muted d-block mt-1">Optional. Click the map or drag the pin to the farm. Zoom in for accuracy.</small>
        }
    `,
    styles: [
        `
            .fpms-location-map {
                height: 280px;
                border: 1px solid #ced4da;
                border-radius: 0.25rem;
                z-index: 0; /* keep Leaflet's panes under dropdowns and modals */
            }
        `,
    ],
})
export class LocationPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
    @Input() lat: number | null | undefined;
    @Input() lng: number | null | undefined;
    @Output() latChange = new EventEmitter<number | null>();
    @Output() lngChange = new EventEmitter<number | null>();

    /** One-line address used by "Find address on map". Hidden when empty. */
    @Input() address = '';
    /** Show the pin only; no clicking, dragging or buttons. */
    @Input() readonly = false;

    @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

    private cdr = inject(ChangeDetectorRef);
    private map: any;
    private marker: any;

    busy = false;
    loadFailed = false;
    message = '';

    /** Sarangani Bay / General Santos City, shown when no pin is set yet. */
    private static readonly DefaultCenter: [number, number] = [6.05, 125.15];

    get hasPin(): boolean {
        return this.lat != null && this.lng != null;
    }

    async ngAfterViewInit(): Promise<void> {
        let L: any;
        try {
            L = await loadLeaflet();
        } catch {
            this.loadFailed = true;
            this.cdr.markForCheck();
            return;
        }

        this.map = L.map(this.mapEl.nativeElement, { scrollWheelZoom: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        }).addTo(this.map);

        if (!this.readonly) {
            this.map.on('click', (e: any) => this.setPin(e.latlng.lat, e.latlng.lng));
        }
        this.syncMarker(true);

        // The map is often created inside a wizard step or tab that has only just appeared.
        setTimeout(() => this.map?.invalidateSize(), 0);
    }

    ngOnChanges(): void {
        // Coordinates typed into the number fields move the pin too.
        this.syncMarker(false);
    }

    ngOnDestroy(): void {
        this.map?.remove();
        this.map = null;
    }

    async findAddress(): Promise<void> {
        const q = this.address?.trim();
        if (!q) {
            return;
        }
        this.busy = true;
        this.message = 'Searching…';
        this.cdr.markForCheck();
        try {
            const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
            const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const hits: { lat: string; lon: string; display_name: string }[] = res.ok ? await res.json() : [];
            if (hits.length) {
                this.setPin(+hits[0].lat, +hits[0].lon, 15);
                this.message = 'Found: ' + hits[0].display_name + '. Check the pin and drag it onto the farm.';
            } else {
                this.message = 'Address not found. Try searching only the barangay and city, or place the pin by hand.';
            }
        } catch {
            this.message = 'Address search is not available right now. Place the pin by hand.';
        } finally {
            this.busy = false;
            this.cdr.markForCheck();
        }
    }

    useMyLocation(): void {
        if (!navigator.geolocation) {
            this.message = 'This browser cannot share its location.';
            return;
        }
        this.busy = true;
        this.message = 'Getting your location…';
        this.cdr.markForCheck();
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.busy = false;
                this.setPin(pos.coords.latitude, pos.coords.longitude, 16);
                this.message = 'Pinned at your current location (accurate to about ' + Math.round(pos.coords.accuracy) + ' m).';
                this.cdr.markForCheck();
            },
            () => {
                this.busy = false;
                this.message = 'Location permission was denied or unavailable. Place the pin by hand.';
                this.cdr.markForCheck();
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    clear(): void {
        this.lat = null;
        this.lng = null;
        this.latChange.emit(null);
        this.lngChange.emit(null);
        this.message = '';
        this.syncMarker(false);
        this.cdr.markForCheck();
    }

    /** Stores the pin rounded to 6 decimals (about 0.1 m), which matches the database column precision (9, 6). */
    private setPin(lat: number, lng: number, zoom?: number): void {
        this.lat = round6(lat);
        this.lng = round6(lng);
        this.latChange.emit(this.lat);
        this.lngChange.emit(this.lng);
        this.syncMarker(false);
        if (zoom) {
            this.map?.setView([this.lat, this.lng], zoom);
        }
        this.cdr.markForCheck();
    }

    private syncMarker(firstTime: boolean): void {
        const L = (window as any).L;
        if (!this.map || !L) {
            return;
        }
        if (!this.hasPin) {
            this.marker?.remove();
            this.marker = null;
            if (firstTime) {
                this.map.setView(LocationPickerComponent.DefaultCenter, 10);
            }
            return;
        }
        const pos: [number, number] = [Number(this.lat), Number(this.lng)];
        if (!this.marker) {
            this.marker = L.marker(pos, { draggable: !this.readonly, keyboard: !this.readonly }).addTo(this.map);
            this.marker.on('dragend', () => {
                const p = this.marker.getLatLng();
                this.setPin(p.lat, p.lng);
            });
        } else {
            this.marker.setLatLng(pos);
        }
        if (firstTime) {
            this.map.setView(pos, 15);
        }
    }
}

function round6(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

const LEAFLET_VERSION = '1.9.4';
let leafletLoading: Promise<any> | null = null;

/** Adds Leaflet's CSS and script to the page once; later maps reuse it. */
function loadLeaflet(): Promise<any> {
    if ((window as any).L) {
        return Promise.resolve((window as any).L);
    }
    if (!leafletLoading) {
        leafletLoading = new Promise((resolve, reject) => {
            const base = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/`;
            const css = document.createElement('link');
            css.rel = 'stylesheet';
            css.href = base + 'leaflet.css';
            document.head.appendChild(css);

            const js = document.createElement('script');
            js.src = base + 'leaflet.js';
            js.onload = () => resolve((window as any).L);
            js.onerror = () => {
                leafletLoading = null; // allow a retry next time a map is shown
                js.remove();
                reject(new Error('Leaflet failed to load'));
            };
            document.body.appendChild(js);
        });
    }
    return leafletLoading;
}
