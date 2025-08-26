import { App, TFile, Notice } from 'obsidian';
import SevenFiftyPluginSettings from './SevenFiftyPluginSettings';

export class StatsManager {
	private app: App;
	private settings: SevenFiftyPluginSettings;

	constructor(app: App, settings: SevenFiftyPluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	async createStatsPage() {
		const folderPath = this.settings.folderPath;
		const statsFilePath = `${folderPath}/📊 Writing Statistics.md`;

		// Ensure the folder exists
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}

		// Generate stats content
		const statsContent = await this.generateStatsContent();

		// Create or update the stats file
		const statsFileRef = this.app.vault.getAbstractFileByPath(statsFilePath);
		let statsFile: TFile;
		
		if (!statsFileRef || !(statsFileRef instanceof TFile)) {
			statsFile = await this.app.vault.create(statsFilePath, statsContent);
		} else {
			statsFile = statsFileRef;
			await this.app.vault.modify(statsFile, statsContent);
		}

		// Open the stats file
		const leaf = this.app.workspace.getUnpinnedLeaf();
		await leaf.openFile(statsFile);

		new Notice('Writing statistics updated!');
	}

	async generateStatsContent(): Promise<string> {
		const dailyWordCounts = this.settings.dailyWordCounts;
		const entries = Object.entries(dailyWordCounts);
		
		if (entries.length === 0) {
			return `

No writing sessions recorded yet. Start your first session to see statistics here!

---

*This page is automatically generated. It will update each time you view statistics.*`;
		}

		// Calculate statistics
		const totalSessions = entries.length;
		const completedSessions = entries.filter(([_, wordCount]) => wordCount >= this.settings.wordCount).length;
		const totalWords = entries.reduce((sum, [_, wordCount]) => sum + wordCount, 0);
		const avgWordsPerSession = Math.round(totalWords / totalSessions);
		const completionRate = Math.round((completedSessions / totalSessions) * 100);

		// Sort entries by date (newest first)
		entries.sort(([a], [b]) => b.localeCompare(a));

		// Get recent streak
		let currentStreak = 0;
		const today = new Date().toISOString().split('T')[0];
		const checkDate = new Date(today);
		
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const dateStr = checkDate.toISOString().split('T')[0];
			const wordCount = dailyWordCounts[dateStr] || 0;
			
			if (wordCount >= this.settings.wordCount) {
				currentStreak++;
				checkDate.setDate(checkDate.getDate() - 1);
			} else {
				break;
			}
		}

		// Generate content
		let content = `*Last updated: ${new Date().toLocaleString()}*

| Metric | Value |
|--------|-------|
| **Total Sessions** | ${totalSessions} |
| **Completed Sessions** | ${completedSessions} |
| **Completion Rate** | ${completionRate}% |
| **Current Streak** | ${currentStreak} days |
| **Total Words Written** | ${totalWords.toLocaleString()} |
| **Average Words/Session** | ${avgWordsPerSession} |
| **Daily Goal** | ${this.settings.wordCount} words |

## 📅 Recent Sessions

| Date | Words | Goal Met | Progress |
|------|-------|----------|----------|
`;

		// Add recent sessions (last 14 days)
		const recentEntries = entries.slice(0, 14);
		for (const [date, wordCount] of recentEntries) {
			const goalMet = wordCount >= this.settings.wordCount ? '✅' : '❌';
			const percentage = Math.round((wordCount / this.settings.wordCount) * 100);
			const progressBar = this.createProgressBar(percentage);
			
			content += `| ${date} | ${wordCount.toLocaleString()} | ${goalMet} | ${progressBar} ${percentage}% |\n`;
		}

		content += `\n## 📅 Writing Calendar

<div class="seven-fifty-calendar">
${this.createWritingCalendar()}
</div>

**Legend:** <span class="seven-fifty-goal-met">Goal Met</span> | <span class="seven-fifty-partial">Partial</span> | <span class="seven-fifty-no-writing">No Writing</span> | <span class="seven-fifty-future">Future</span>

---

*This page is automatically generated. It updates each time you view statistics. To regenerate it, use the command palette to run \`Seven Fifty: View Writing Statistics\`.*`;

		return content;
	}

	private createProgressBar(percentage: number): string {
		const barLength = 10;
		const filled = Math.max(0, Math.min(barLength, Math.round((percentage / 100) * barLength)));
		const empty = Math.max(0, barLength - filled);
		return '█'.repeat(filled) + '░'.repeat(empty);
	}

	private createWritingCalendar(): string {
		const dailyWordCounts = this.settings.dailyWordCounts;
		const entries = Object.entries(dailyWordCounts);
		
		if (entries.length === 0) {
			return 'No writing sessions recorded yet.';
		}

		// Get the earliest writing date and current date - work with strings only
		const dates = entries.map(([date, _wordCount]) => date).sort();
		const earliestDateStr = dates[0];
		
		// Parse the earliest date manually - no Date constructor
		const [earliestYear, earliestMonth] = earliestDateStr.split('-').map(Number);
		
		// Get current date in local timezone
		const now = new Date();
		const currentYear = now.getFullYear();
		const currentMonth = now.getMonth() + 1; // Convert to 1-indexed for consistency
		const currentDay = now.getDate();
		
		// Start from the month of the earliest writing
		const startMonth = earliestMonth; // Keep 1-indexed
		const startYear = earliestYear;
		
		let calendar = '';
		const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
			'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		
		// Iterate through each month from start to current
		let year = startYear;
		let month = startMonth; // 1-indexed
		
		while (year < currentYear || (year === currentYear && month <= currentMonth)) {
			const monthName = monthNames[month - 1]; // Convert to 0-indexed for array access
				calendar += `<div class="seven-fifty-month">
<h5>${monthName} ${year}</h5>
<div class="seven-fifty-days">`;
				
				// Get number of days in this month (using Date constructor is safe here for day count)
				const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-indexed, so this gets last day
				
				// Create the days
				for (let day = 1; day <= daysInMonth; day++) {
					const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
					const wordCount = dailyWordCounts[dateStr] || 0;
					
					let cssClass = 'seven-fifty-day';
					
					// Determine CSS class based on word count and date (compare as numbers, not Date objects)
					const isFuture = year > currentYear || 
									(year === currentYear && month > currentMonth) || 
									(year === currentYear && month === currentMonth && day > currentDay);
					
					if (isFuture) {
						// Future date
						cssClass += ' seven-fifty-future';
					} else if (wordCount >= this.settings.wordCount) {
						// Goal met
						cssClass += ' seven-fifty-goal-met';
					} else if (wordCount > 0) {
						// Partial writing
						cssClass += ' seven-fifty-partial';
					} else {
						// No writing
						cssClass += ' seven-fifty-no-writing';
					}
					
					calendar += `<span class="${cssClass}">${day}</span>`;
				}
				
				calendar += `</div></div>\n`;
			
			// Move to next month
			month++;
			if (month > 12) {
				month = 1;
				year++;
			}
		}
		
		return calendar;
	}

	// Method to update settings reference when settings change
	updateSettings(settings: SevenFiftyPluginSettings) {
		this.settings = settings;
	}
}
