import {
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo
} from "obsidian";
import { Admonition } from "src/@types";
import ObsidianAdmonition from "src/main";

abstract class AdmonitionOrCalloutSuggester extends EditorSuggest<
    [string, Admonition]
> {
    constructor(public plugin: ObsidianAdmonition) {
        super(plugin.app);
    }
    getSuggestions(ctx: EditorSuggestContext) {
        if (!ctx.query?.length) return Object.entries(this.plugin.admonitions);

        return Object.entries(this.plugin.admonitions).filter((p) =>
            p[0].toLowerCase().contains(ctx.query.toLowerCase())
        );
    }
    renderSuggestion(
        [text, item]: [text: string, item: Admonition],
        el: HTMLElement
    ) {
        el.addClasses(["admonition-suggester-item", "mod-complex"]);
        el.style.setProperty("--callout-color", item.color);
        el.createSpan({ text });
        const iconDiv = el.createDiv("suggestion-aux").createDiv({
            cls: "suggestion-flair",
            attr: {
                style: `color: rgb(var(--callout-color))`
            }
        });
        let iconEl = this.plugin.iconManager.getIconNode(item.icon);
        // Unpack the icon if it's an Obsidian one, as they're wrapped with an extra <div>
        if (iconEl instanceof HTMLDivElement && iconEl.childElementCount == 1)
            iconEl = iconEl.firstElementChild;
        else if (iconEl !== null) {
            iconEl.removeClass("svg-inline--fa");
            iconEl.addClass("svg-icon");
        }
        iconDiv.appendChild(iconEl ?? createDiv());
    }
    onTrigger(
        cursor: EditorPosition,
        editor: Editor
    ): EditorSuggestTriggerInfo {
        const line = editor.getLine(cursor.line);
        const match = this.testAndReturnQuery(line, cursor);
        if (!match) return null;
        const [_, query] = match;

        if (
            Object.keys(this.plugin.admonitions).find(
                (p) => p.toLowerCase() == query.toLowerCase()
            )
        ) {
            return null;
        }

        return {
            end: cursor,
            start: {
                ch: match.index + this.offset,
                line: cursor.line
            },
            query
        };
    }
    abstract offset: number;
    abstract selectSuggestion(
        value: [string, Admonition],
        evt: MouseEvent | KeyboardEvent
    ): void;
    abstract testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null;
}

export class CalloutSuggest extends AdmonitionOrCalloutSuggester {
    offset = 4;
    selectSuggestion(
        [text]: [text: string, item: Admonition],
        evt: MouseEvent | KeyboardEvent
    ): void {
        if (!this.context) return;
        const editor = this.context.editor;
        const triggerEnd = this.context.end;
        const line = editor.getLine(triggerEnd.line);
        
        // Use regex to match and replace the entire relevant part
        const match = this.testAndReturnQuery(line, triggerEnd);
        if (!match) return;

        // Define the range to replace
        const matchStart = match.index; 
        const matchLength = match[0].length;
        const startPosition = {line: triggerEnd.line, ch:matchStart + this.offset}  // starting at ">[!"
        const endPosition = {line: triggerEnd.line, ch:matchStart + matchLength}    // Up to the last matched character

        editor.replaceRange(
            `${text}] `,
            startPosition,
            endPosition,
            "admonitions"
        );

        editor.setCursor(
            this.context.start.line,
            startPosition.ch + text.length +2
        );

        this.close();
    }
    testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null {
        if (/> ?\[!\w+\]/.test(line.slice(0, cursor.ch))) return null;
        if (!/> ?\[!\w*/.test(line)) return null;
        else {
            // Adjust offset: 4 if space after ">["; otherwise, 3 (e.g., >[!).
            // The offset depends on whether there is a space between ">[" or not. 
            const match = line.match(/> ?\[! *(\w*) *\]? ?/);
            this.offset = (/> /.test(line)) ? 4 : 3;
            return match;
        }
    }
}
export class AdmonitionSuggest extends AdmonitionOrCalloutSuggester {
    offset = 6;
    selectSuggestion(
        [text]: [text: string, item: Admonition],
        evt: MouseEvent | KeyboardEvent
    ): void {
        if (!this.context) return;

        this.context.editor.replaceRange(
            `${text}`,
            this.context.start,
            this.context.end,
            "admonitions"
        );

        this.close();
    }
    testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null {
        if (!/```ad-\w*/.test(line)) return null;
        return line.match(/```ad-(\w*)/);
    }
}
