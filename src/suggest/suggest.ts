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
    offset = 3;
    selectSuggestion(
        [text]: [text: string, item: Admonition],
        evt: MouseEvent | KeyboardEvent
    ): void {
        if (!this.context) return;

        const line = this.context.editor
            .getLine(this.context.end.line) // 한 줄을 다 가져옴
            .slice(this.context.end.ch); // 커서 이후의 텍스트를 잘라서 확인
        const [, exists] = line.match(/^(\]?)/) ?? [];

        // 공백이 있을 시 띄워쓰기 시 괄호가 하나 더 생기는 문제 발생, 따라서 앞에 공백이 있는지 없는지 여부를 먼저 판단
        // 공백이  없을 경우에는 기존 코드 유지
        // 위 문제를 해결 시 띄워쓰기를 했을 때 앞에 !가 사라지는 문제 발생
        // 따라서 조건문을 통해 띄워썼을 때와  공백이 없을 때를 구분해서 분류
        
        const hasSpace = /> \[!\w*/.test(this.context.editor.getLine(this.context.start.line)); 
        const prefix = "!";

        this.context.editor.replaceRange(
            hasSpace ? `${prefix}${text}` : `${text}]`,
            this.context.start,
            {
                ...this.context.end,
                ch:
                    this.context.start.ch +
                    this.context.query.length +
                    (exists?.length ?? 0)
            },
            "admonitions"
        );

        this.context.editor.setCursor(
            this.context.start.line,
            this.context.start.ch + text.length + 2
        );

        this.close();
    }
    testAndReturnQuery(
        line: string,
        cursor: EditorPosition
    ): RegExpMatchArray | null {
        if (/> ?\[!\w+\]/.test(line.slice(0, cursor.ch))) return null; // 자동완성 항목을 띄우는 부분
        if (!/> ?\[!\w*/.test(line)) return null; // 

        return line.match(/> ?\[!(\w*)\]?/);
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
