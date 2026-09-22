"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const SLACK_PX = 24;

/**
 * Keeps a log viewport on its newest line. Scrolling up pauses following so a
 * line can be read; scrolling back to the bottom, or `jump()`, resumes it.
 * Pass anything that changes when content arrives as `content`.
 */
export function useStickToBottom<T extends HTMLElement = HTMLDivElement>(content: unknown) {
  const ref = useRef<T>(null);
  const following = useRef(true);
  const [paused, setPaused] = useState(false);

  const onScroll = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= SLACK_PX;
    following.current = atBottom;
    setPaused(!atBottom);
  }, []);

  const jump = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    following.current = true;
    setPaused(false);
    node.scrollTop = node.scrollHeight;
  }, []);

  // Before paint, so a new batch never flashes above the fold.
  useLayoutEffect(() => {
    const node = ref.current;
    if (node && following.current) node.scrollTop = node.scrollHeight;
  }, [content]);

  return { ref, onScroll, paused, jump };
}
