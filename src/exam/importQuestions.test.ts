import { describe, expect, it } from "vitest";
import { parseImportedQuestions, toSetQuestionDocs } from "./importQuestions";

describe("parseImportedQuestions", () => {
  it("parsuje obiekt questions i oznaczenia correct", () => {
    const raw = JSON.stringify({
      questions: [
        {
          kind: "single",
          prompt: "Ile to 2+2?",
          options: [
            { text: "3", correct: false },
            { text: "4", correct: true },
          ],
        },
        { kind: "open", prompt: "Wyjaśnij." },
      ],
    });
    const drafts = parseImportedQuestions(raw);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.kind).toBe("single");
    expect(drafts[0]?.options?.filter((o) => o.correct)).toHaveLength(1);

    const docs = toSetQuestionDocs(drafts, 1);
    expect(docs[0]?.correctOptionIds).toHaveLength(1);
    expect(docs[1]?.kind).toBe("open");
  });

  it("akceptuje blok markdown json", () => {
    const raw = "```json\n[{\"kind\":\"ledger\",\"prompt\":\"Zaksięguj.\"}]\n```";
    expect(parseImportedQuestions(raw)).toHaveLength(1);
  });

  it("odrzuca single bez dokładnie jednej poprawnej", () => {
    expect(() =>
      parseImportedQuestions(
        JSON.stringify([
          {
            kind: "single",
            prompt: "Q",
            options: [
              { text: "A", correct: true },
              { text: "B", correct: true },
            ],
          },
        ]),
      ),
    ).toThrow(/jednokrotnym/);
  });
});
