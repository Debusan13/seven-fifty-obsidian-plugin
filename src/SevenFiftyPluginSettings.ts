export default class SevenFiftyPluginSettings {
    public timeoutSeconds: number;
    public wordCount: number;
    public folderPath: string;
    public showRibbonIcon: boolean;
    public dailyWordCounts: Record<string, number>; // Store word counts by date
}

export const DEFAULT_SETTINGS: SevenFiftyPluginSettings = {
    timeoutSeconds: 30,
    wordCount: 750,
    folderPath: '750 Words',
    showRibbonIcon: false,
    dailyWordCounts: {}
};
