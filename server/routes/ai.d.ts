import type { Router } from 'express';

/** Robustly extract a JSON object from an LLM response (may throw). */
export function extractJson(text: string): unknown;

/** Express router exposing /status, /lesson, /adapt and /retry endpoints. */
export default function aiRouter(): Router;
