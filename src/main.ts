import { MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, type App } from "obsidian";
import { linesForRules, normalizeRule, rulesForFoldedLines, type FoldRule } from "./folds";

type FoldInfo = { folds: Array<{ from: number; to: number }>; lines: number };
type FoldMode = {
  getFoldInfo?: () => FoldInfo | null;
  applyFoldInfo?: (info: FoldInfo) => void;
};

type FoldView = MarkdownView & {
  editMode?: FoldMode;
  currentMode?: FoldMode;
};

type Settings = {
  propertyName: string;
  replaceOtherFolds: boolean;
  autoSync: boolean;
};

const defaults: Settings = {
  propertyName: "folds",
  replaceOtherFolds: false,
  autoSync: true
};

export default class FrontmatterFoldsPlugin extends Plugin {
  override settings: Settings = defaults;
  private applying = new WeakSet<MarkdownView>();
  private syncing = new WeakSet<MarkdownView>();
  private syncTimers = new WeakMap<MarkdownView, number>();
  private patchedViewPrototype: object | null = null;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "sync-current-folds-to-frontmatter",
      name: "Sync current folds to frontmatter",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (!checking) void this.syncView(view);
        return true;
      }
    });

    this.addCommand({
      id: "apply-frontmatter-folds",
      name: "Apply folds from frontmatter",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        if (!checking) void this.applyView(view, true);
        return true;
      }
    });

    this.addSettingTab(new FrontmatterFoldsSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on("file-open", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.patchViewLoading(view);
        this.scheduleView(view);
      }
    }));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleActiveView()));
    this.app.workspace.onLayoutReady(() => {
      for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view instanceof MarkdownView) {
          this.patchViewLoading(leaf.view);
          this.scheduleView(leaf.view);
        }
      }
    });
  }

  private scheduleActiveView(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      this.patchViewLoading(view);
      this.scheduleView(view);
    }
  }

  private scheduleView(view: MarkdownView): void {
    window.setTimeout(() => void this.applyView(view), 100);
  }

  private patchViewLoading(view: MarkdownView): void {
    const prototype = Object.getPrototypeOf(view) as {
      onLoadFile?: (file: TFile) => Promise<void>;
      onMarkdownFold?: (...args: unknown[]) => unknown;
    };
    if (this.patchedViewPrototype === prototype || typeof prototype.onLoadFile !== "function") return;

    const original = prototype.onLoadFile;
    const originalFold = prototype.onMarkdownFold;
    const plugin = this;
    const patched = async function(this: MarkdownView, file: TFile): Promise<void> {
      await original.call(this, file);
      await plugin.applyView(this);
    };
    prototype.onLoadFile = patched;
    const patchedFold = function(this: MarkdownView, ...args: unknown[]): unknown {
      const result = originalFold?.apply(this, args);
      plugin.scheduleSync(this);
      return result;
    };
    prototype.onMarkdownFold = patchedFold;
    this.patchedViewPrototype = prototype;
    this.register(() => {
      if (prototype.onLoadFile === patched) prototype.onLoadFile = original;
      if (prototype.onMarkdownFold === patchedFold) prototype.onMarkdownFold = originalFold;
    });
  }

  private scheduleSync(view: MarkdownView): void {
    if (!this.settings.autoSync || this.applying.has(view) || this.syncing.has(view)) return;
    const existing = this.syncTimers.get(view);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      this.syncTimers.delete(view);
      if (!this.applying.has(view) && !this.syncing.has(view)) void this.syncView(view, false);
    }, 500);
    this.syncTimers.set(view, timer);
  }

  private getMode(view: MarkdownView): FoldMode | null {
    const foldView = view as FoldView;
    return foldView.editMode ?? foldView.currentMode ?? null;
  }

  private readRules(file: TFile): FoldRule[] {
    const raw = this.app.metadataCache.getFileCache(file)?.frontmatter?.[this.settings.propertyName];
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeRule).filter((rule): rule is FoldRule => rule !== null);
  }

  private async applyView(view: MarkdownView, showNotice = false): Promise<void> {
    if (!view.file || this.applying.has(view)) return;
    const mode = this.getMode(view);
    if (!mode?.applyFoldInfo) return;

    const rules = this.readRules(view.file);
    if (rules.length === 0) return;
    this.applying.add(view);
    try {
      const markdown = view.editor.getValue();
      const ruleLines = linesForRules(markdown, rules);
      const existing = this.settings.replaceOtherFolds ? [] : (mode.getFoldInfo?.()?.folds ?? []);
      const byLine = new Map(existing.map((fold) => [fold.from, fold]));
      for (const line of ruleLines) byLine.set(line, { from: line, to: line + 1 });
      mode.applyFoldInfo({ folds: [...byLine.values()], lines: view.editor.lineCount() });
      if (showNotice) new Notice(`Applied ${ruleLines.length} frontmatter fold${ruleLines.length === 1 ? "" : "s"}.`);
    } finally {
      this.applying.delete(view);
    }
  }

  private async syncView(view: MarkdownView, showNotice = true): Promise<void> {
    const file = view.file;
    const mode = this.getMode(view);
    if (!file) return;
    if (!mode?.getFoldInfo) {
      if (showNotice) new Notice("Could not read this editor's fold state. Switch to Editing view and try again.");
      return;
    }

    this.syncing.add(view);
    try {
      const markdown = view.editor.getValue();
      const foldedLines = new Set((mode.getFoldInfo()?.folds ?? []).map((fold) => fold.from));
      const rules = rulesForFoldedLines(markdown, foldedLines);
      const unsupported = foldedLines.size - rules.length;

      if (JSON.stringify(this.readRules(file)) !== JSON.stringify(rules)) {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          if (rules.length === 0) delete frontmatter[this.settings.propertyName];
          else frontmatter[this.settings.propertyName] = rules;
        });
      }

      if (showNotice) {
        const skipped = unsupported > 0 ? ` Skipped ${unsupported} non-heading/list fold${unsupported === 1 ? "" : "s"}.` : "";
        new Notice(`Synced ${rules.length} fold${rules.length === 1 ? "" : "s"} to frontmatter.${skipped}`);
      }
    } finally {
      this.syncing.delete(view);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...defaults, ...(await this.loadData() as Partial<Settings> | null) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class FrontmatterFoldsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: FrontmatterFoldsPlugin) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Frontmatter property")
      .setDesc("The YAML property used to store fold selectors.")
      .addText((text) => text
        .setPlaceholder("folds")
        .setValue(this.plugin.settings.propertyName)
        .onChange(async (value) => {
          this.plugin.settings.propertyName = value.trim() || defaults.propertyName;
          await this.plugin.saveSettings();
        }));

    new Setting(this.containerEl)
      .setName("Sync fold changes automatically")
      .setDesc("Update frontmatter shortly after a heading or list is folded or unfolded.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(this.containerEl)
      .setName("Replace other folds on open")
      .setDesc("When enabled, opening a note unfolds anything not listed in frontmatter.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.replaceOtherFolds)
        .onChange(async (value) => {
          this.plugin.settings.replaceOtherFolds = value;
          await this.plugin.saveSettings();
        }));
  }
}
