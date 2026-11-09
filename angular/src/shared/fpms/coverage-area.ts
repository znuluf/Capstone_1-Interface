/**
 * The area the system covers: General Santos City and the province of Sarangani. The farm address uses these as
 * dropdowns (province, then city or municipality). General Santos is an independent city; it is listed under
 * South Cotabato, the province it sits in, as on its postal address. Postal codes fill in an empty postal code field.
 */
export interface CoverageCity {
    name: string;
    postalCode: string;
}

export interface CoverageProvince {
    name: string;
    cities: CoverageCity[];
}

export const COVERAGE_AREA: CoverageProvince[] = [
    { name: 'South Cotabato', cities: [{ name: 'General Santos City', postalCode: '9500' }] },
    {
        name: 'Sarangani',
        cities: [
            { name: 'Alabel', postalCode: '9501' },
            { name: 'Glan', postalCode: '9517' },
            { name: 'Kiamba', postalCode: '9514' },
            { name: 'Maasim', postalCode: '9502' },
            { name: 'Maitum', postalCode: '9515' },
            { name: 'Malapatan', postalCode: '9516' },
            { name: 'Malungon', postalCode: '9503' },
        ],
    },
];

/** Province names, plus the current value when an older record holds one outside the list (so it is not lost). */
export function coverageProvinces(current?: string): string[] {
    const names = COVERAGE_AREA.map((p) => p.name);
    return current && !names.includes(current) ? [...names, current] : names;
}

/** Cities and municipalities of a province, plus the current value when it is outside the list. */
export function coverageCities(province: string, current?: string): string[] {
    const names = COVERAGE_AREA.find((p) => p.name === province)?.cities.map((c) => c.name) ?? [];
    return current && !names.includes(current) ? [...names, current] : names;
}

/** Applies a province choice: keeps the city if it belongs to it, picks the only city when there is one, else clears it. */
export function applyCoverageProvince(model: { province?: string; cityMunicipality?: string; postalCode?: string }): void {
    const cities = COVERAGE_AREA.find((p) => p.name === model.province)?.cities ?? [];
    if (!cities.some((c) => c.name === model.cityMunicipality)) {
        model.cityMunicipality = cities.length === 1 ? cities[0].name : '';
    }

    applyCoverageCity(model);
}

/** Fills an empty postal code from the chosen city or municipality. */
export function applyCoverageCity(model: { province?: string; cityMunicipality?: string; postalCode?: string }): void {
    const city = COVERAGE_AREA.find((p) => p.name === model.province)?.cities.find((c) => c.name === model.cityMunicipality);
    if (city && !model.postalCode?.trim()) {
        model.postalCode = city.postalCode;
    }
}
