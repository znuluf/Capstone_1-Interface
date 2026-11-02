// "Production" enabled environment

export const environment = {
    production: true,
    appConfig: 'appconfig.production.json',
    devAccounts: [] as { group: string; label: string; farmCode: string; userName: string; password: string }[],
};
