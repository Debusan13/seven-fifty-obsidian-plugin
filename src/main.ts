import { Plugin, TFile, Editor, MarkdownView, Notice } from 'obsidian';
import { DEFAULT_SETTINGS } from './SevenFiftyPluginSettings';
import SevenFiftySettingsTab from './SevenFiftyPluginSettingsTab';
import SevenFiftyPluginSettings from './SevenFiftyPluginSettings';
import { StatsManager } from './StatsManager';

export default class SevenFiftyPlugin extends Plugin {
	settings: SevenFiftyPluginSettings;
	private statusBarItem: HTMLElement;
	private currentWordCount = 0;
	private ribbonIcon: HTMLElement | null = null;
	private statsManager: StatsManager;

	async onload() {
		await this.loadSettings();
		this.statsManager = new StatsManager(this.app, this.settings);
        this.addSettingTab(new SevenFiftySettingsTab(this.app, this));

		// Scan for existing daily writing files and update word counts
		await this.scanExistingDailyFiles();

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();

		// Add ribbon icon if enabled
		this.refreshRibbonIcon();

        this.addCommand({
			id: 'open-seven-fifty',
			name: `Open today's ${this.settings.wordCount} words`,
			callback: () => {
				this.openTodaysWriting();
			}
		});

		this.addCommand({
			id: 'seven-fifty-stats',
			name: 'View writing statistics',
			callback: () => {
				this.showWritingStats();
			}
		});

		// Register event to track word count changes
		this.registerEvent(
			this.app.workspace.on('editor-change', async (editor: Editor) => {
				await this.updateWordCount(editor);
			})
		);

	}

	async showWritingStats() {
		await this.statsManager.createStatsPage();
	}

	async scanExistingDailyFiles() {
		const folderPath = this.settings.folderPath;
		
		// Get all markdown files in the writing folder
		const allFiles = this.app.vault.getMarkdownFiles();
		const dailyFiles = allFiles.filter(file => 
			file.path.includes(folderPath) && 
			file.name.includes('Daily Writing') &&
			file.name.match(/\d{4}-\d{2}-\d{2}/) // Has date format
		);

		let updatedCount = 0;
		
		for (const file of dailyFiles) {
			// Extract date from filename
			const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
			if (!dateMatch) continue;
			
			const dateStr = dateMatch[1];
			
			// Only update if we don't already have word count data for this date
			if (!this.settings.dailyWordCounts[dateStr]) {
				try {
					const content = await this.app.vault.read(file);
					const wordCount = this.countWords(content);
					this.settings.dailyWordCounts[dateStr] = wordCount;
					updatedCount++;
				} catch (error) {
					console.warn(`Failed to read file ${file.path}:`, error);
				}
			}
		}

		// Save settings if we found any new files
		if (updatedCount > 0) {
			await this.saveSettings();
			console.log(`Seven Fifty: Updated word counts for ${updatedCount} existing daily writing files`);
		}
	}

	onunload() {
		// Clean up ribbon icon if it exists
		if (this.ribbonIcon) {
			this.ribbonIcon.remove();
			this.ribbonIcon = null;
		}
	}

	async openTodaysWriting() {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
		const fileName = `${today} - Daily Writing.md`;
		const folderPath = this.settings.folderPath;

		// Ensure the folder exists
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}

		const filePath = `${folderPath}/${fileName}`;
		const fileRef = this.app.vault.getAbstractFileByPath(filePath);
		let file: TFile;

		if (!fileRef || !(fileRef instanceof TFile)) {
			file = await this.app.vault.create(filePath, '');
		} else {
			file = fileRef;
		}

		const leaf = this.app.workspace.getLeaf());
		await leaf.openFile(file);
		
		// Focus on the editor
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			view.editor.focus();
			// Position cursor at the end of existing content
			const lastLine = view.editor.lastLine();
			const lastLineLength = view.editor.getLine(lastLine).length;
			view.editor.setCursor(lastLine, lastLineLength);
			
			// Update word count for today
			const content = view.editor.getValue();
			this.currentWordCount = this.countWords(content);
			this.updateStatusBar();
		}

		new Notice(`Today's ${this.settings.wordCount} words session started!`);
	}

	private async updateWordCount(editor: Editor) {
		const content = editor.getValue();
		this.currentWordCount = this.countWords(content);
		
		// Update daily word count in settings if this is a daily writing file
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file && this.isDailyWritingFile(view.file)) {
            const date = view.file.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
			await this.updateDailyWordCount(date, this.currentWordCount);
		}
		
		this.updateStatusBar();
	}

	private async updateDailyWordCount(date: string | undefined, wordCount: number) {
        if (!date) {
            console.warn('Seven Fifty: Unable to extract date from filename for daily word count update.');
            return;
        }

		if (this.settings.dailyWordCounts[date] !== wordCount) {
			this.settings.dailyWordCounts[date] = wordCount;
			await this.saveSettings();
		}
	}

	private isDailyWritingFile(file: TFile): boolean {
		return file.path.includes(this.settings.folderPath) && file.name.includes('Daily Writing');
	}

	private countWords(text: string): number {
		// Remove markdown syntax and count words
		const cleanText = text
			.replace(/#+\s/g, '') // Remove headers
			.replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
			.replace(/\*(.*?)\*/g, '$1') // Remove italic
			.replace(/`(.*?)`/g, '$1') // Remove inline code
			.replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
			.replace(/---/g, '') // Remove horizontal rules
			.replace(/\n\s*\n/g, ' ') // Replace multiple newlines with space
			.trim();

		if (!cleanText) return 0;
		
		return cleanText.split(/\s+/).filter(word => word.length > 0).length;
	}

	private updateStatusBar() {
		if (!this.statusBarItem) return;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const isDailyFile = view?.file && this.isDailyWritingFile(view.file);

		if (isDailyFile) {
			const percentage = Math.min(100, Math.round((this.currentWordCount / this.settings.wordCount) * 100));
			const remaining = Math.max(0, this.settings.wordCount - this.currentWordCount);
			
			this.statusBarItem.setText(
				`✍️ ${this.currentWordCount}/${this.settings.wordCount} words (${percentage}%) - ${remaining} to go`
			);
			
			// Remove existing progress classes
			this.statusBarItem.removeClass('seven-fifty-progress-low');
			this.statusBarItem.removeClass('seven-fifty-progress-low-med');
			this.statusBarItem.removeClass('seven-fifty-progress-medium');
			this.statusBarItem.removeClass('seven-fifty-progress-med-high');
			this.statusBarItem.removeClass('seven-fifty-progress-high');
			
			// Apply color based on progress ranges
			if (percentage >= 100) {
				this.statusBarItem.addClass('seven-fifty-progress-high');
			} else if (percentage >= 75) {
				this.statusBarItem.addClass('seven-fifty-progress-med-high');
			} else if (percentage >= 50) {
				this.statusBarItem.addClass('seven-fifty-progress-medium');
			} else if (percentage >= 25) {
				this.statusBarItem.addClass('seven-fifty-progress-low-med');
			} else {
				this.statusBarItem.addClass('seven-fifty-progress-low');
			}
		} else {
			this.statusBarItem.setText('750 Words');
			// Remove all progress classes when not in a daily file
			this.statusBarItem.removeClass('seven-fifty-progress-low');
			this.statusBarItem.removeClass('seven-fifty-progress-low-med');
			this.statusBarItem.removeClass('seven-fifty-progress-medium');
			this.statusBarItem.removeClass('seven-fifty-progress-med-high');
			this.statusBarItem.removeClass('seven-fifty-progress-high');
		}
	}

	refreshRibbonIcon() {
		// Remove existing ribbon icon if it exists
		if (this.ribbonIcon) {
			this.ribbonIcon.remove();
			this.ribbonIcon = null;
		}

		// Add ribbon icon if enabled in settings
		if (this.settings.showRibbonIcon) {
			this.ribbonIcon = this.addRibbonIcon('edit', 'Open Daily Writing', () => {
				this.openTodaysWriting();
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update stats manager with new settings
		this.statsManager.updateSettings(this.settings);
		// Status bar will update automatically on next editor change
		this.updateStatusBar();
		// Refresh ribbon icon based on new settings
		this.refreshRibbonIcon();
	}
}

