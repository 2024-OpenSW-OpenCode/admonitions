import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
} from "obsidian";
import { Admonition } from "src/@types";
import ObsidianAdmonition from "src/main";

// 추상 클래스 선언
abstract class AdmonitionOrCalloutSuggester extends EditorSuggest<
  [string, Admonition]
> {
  // 생성자
  constructor(public plugin: ObsidianAdmonition) {
    super(plugin.app);
  }

  // 적절한 제안 목록 반환
  // EditorSuggestContext : 사용자의 현재 입력 상태
  getSuggestions(ctx: EditorSuggestContext) {
    if (!ctx.query?.length) return Object.entries(this.plugin.admonitions);

    return Object.entries(this.plugin.admonitions).filter((p) =>
      p[0].toLowerCase().contains(ctx.query.toLowerCase())
    );
  }

  // 각 제안 아이템을 화면에 렌더링
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
        style: `color: rgb(var(--callout-color))`,
      },
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

  // 사용자가 입력할 때 마다 onTrigger 메소드 호출
  onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo {
    const line = editor.getLine(cursor.line);
    const match = this.testAndReturnQuery(line, cursor);
    if (!match) return null;
    const [_, prefix, query] = match;

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
        ch: match.index + prefix.length,
        line: cursor.line,
      },
      query,
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

// 추상클래스 구현 CalloutSuggest
export class CalloutSuggest extends AdmonitionOrCalloutSuggester {
  offset = 4;
  // 사용자가 제안을 선택했을 때, 에디터의 텍스트를 교체하고 커서 위치를 조정합니다.

  // 메소드 선언
  // text : 사용자가 선택한 callout 이름
  // evt : 이벤트가 뭔지
  selectSuggestion(
    [text]: [text: string, item: Admonition],
    evt: MouseEvent | KeyboardEvent
  ): void {
    // 유효성 검사
    if (!this.context) return;

    const { editor, query, start, end } = this.context;

    const line = editor
      .getLine(end.line) // 현재 커서가 있는 라인의 전체 텍스트
      .slice(end.ch); // 커서 위치 이후 텍스트 추출
    const [_, exists] = line.match(/^(\] ?)/) ?? []; // "]" 또는 "] "로 시작하는지 검사
    // 만약 시작하면 exists에 해당 문자열이 들어감

    // 지정된 범위의 텍스트 대체 함수
    editor.replaceRange(
      `${text}] `, // 대체할 텍스트, "text] "로 대체함

      // 시작과 끝 범위는 {줄 번호, 문자 위치} 의 객체를 가짐
      start, // 대체 범위 시작 위치, "> [!" 바로 다음 위치
      {
        ...end, // 줄은 같으나, ch 위치를 다르게 할거임
        ch:
          start.ch + // 시작위치
          query.length + // 사용자가 입력한 쿼리 문자열 길이
          (exists?.length ?? 0), // 닫는 대괄호가 있으면 그 길이, 아니면 0
      }, //
      "admonitions" // 변경의 출처
    );

    // 커서 위치 조정
    editor.setCursor(
      start.line, // 교체 작업이 일어난 라인 (줄)
      start.ch + text.length + 2 // 교체 작업 후 커서 위치, "[...] "이후위치
    );

    this.close();
  }
  // 현재 라인이 callout 패턴에 맞는지 검사하고, 매칭 결과를 반환합니다.
  testAndReturnQuery(
    line: string, // 현재 커서가 위치한 줄의 전체 텍스트
    cursor: EditorPosition // 커서 위치
  ): RegExpMatchArray | null {
    if (/> ?\[!\w+\]/.test(line.slice(0, cursor.ch))) return null; // 이미 완성된 패턴인지 검사

    const match = line.match(/(> ?\[!)(\w*)\]?/);
    if (!match) return null;
    return match;
  }
}
export class AdmonitionSuggest extends AdmonitionOrCalloutSuggester {
  offset = 6;
  selectSuggestion(
    [text]: [text: string, item: Admonition],
    evt: MouseEvent | KeyboardEvent
  ): void {
    if (!this.context) return;

    const { editor, start, end } = this.context;

    editor.replaceRange(
      `${text}`,
      start,
      end,
      "admonitions"
    );

    editor.setCursor(
      start.line,
      start.ch + text.length
    );

    this.close();
  }
  testAndReturnQuery(
    line: string,
    cursor: EditorPosition
  ): RegExpMatchArray | null {
    if (!/```ad-\w*/.test(line)) return null;
    const match = line.match(/(```ad-)(\w*)/);
    if (!match) return null;
    return match;
  }
}
