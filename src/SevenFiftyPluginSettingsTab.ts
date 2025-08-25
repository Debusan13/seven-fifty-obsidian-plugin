import { App, PluginSettingTab, Setting } from "obsidian";
import SevenFiftyPlugin from './main';

export default class SevenFiftyPluginSettingsTab extends PluginSettingTab {
    private readonly plugin: SevenFiftyPlugin;

    constructor(app: App, plugin: SevenFiftyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Word Count Goal")
            .setDesc("Set your daily word count target")
            .addText(text => text
                .setPlaceholder("750")
                .setValue(String(this.plugin.settings.wordCount))
                .onChange(async (value) => {
                    this.plugin.settings.wordCount = parseInt(value) || 750;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Writing Folder")
            .setDesc("Folder where daily writing files will be stored")
            .addText(text => text
                .setPlaceholder("750 Words")
                .setValue(this.plugin.settings.folderPath)
                .onChange(async (value) => {
                    this.plugin.settings.folderPath = value || '750 Words';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Show Ribbon Icon")
            .setDesc("Display a ribbon icon in the left sidebar for quick access to daily writing")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRibbonIcon)
                .onChange(async (value) => {
                    this.plugin.settings.showRibbonIcon = value;
                    await this.plugin.saveSettings();
                    // Refresh the ribbon icon
                    this.plugin.refreshRibbonIcon();
                }));

        new Setting(containerEl)
            .setName("Timeout Seconds")
            .setDesc("How many seconds before the writing timer pauses (for calculating writing rate)")
            .addText(text => text
                .setPlaceholder("30")
                .setValue(String(this.plugin.settings.timeoutSeconds))
                .onChange(async (value) => {
                    this.plugin.settings.timeoutSeconds = parseInt(value) || 30;
                    await this.plugin.saveSettings();
                }));
    }
}