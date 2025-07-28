import { useRef } from "react";
import MurmurHash3 from "imurmurhash";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export function useDomContent() {
  const domHash = useRef<number | null>(null);
  const domMarkDown = useRef<string | null>(null);
  return async function() {
    const content = await getCurrentTabContent();
    if (!content) {
      domHash.current = null;
      domMarkDown.current = null;
      return null;
    }
    const hashedContent = MurmurHash3(content.documentElement.innerHTML).result();
    if (domHash.current !== hashedContent) {
      domHash.current = hashedContent;
      const article = new Readability(content).parse();
      if (!article?.content) {
        domMarkDown.current = null;
        return null;
      }
      const turndownService = new TurndownService()
      const markdownContent = turndownService.turndown(article.content);
      domMarkDown.current = markdownContent;
    }
    return domMarkDown.current;
  };
}

async function getCurrentTabContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    return null;
  }
  const content = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document,
  });
  return content[0].result ?? null;
}
