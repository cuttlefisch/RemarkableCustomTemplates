/**
 * Expression evaluator for reMarkable template constant expressions.
 *
 * Templates reference named constants in string expressions like:
 *   "templateWidth > mobileMaxWidth ? 0 : mobileOffsetY"
 *   "yHeader + weekNumberHeight"
 *   "templateWidth / 2"
 *
 * Constants are resolved in order — later entries may reference earlier ones.
 */

import type { ConstantEntry, ScalarValue } from '../types/template'

export type ResolvedConstants = Record<string, number>

/** Compile a flat array of single-key constant objects into a resolved map. */
export function resolveConstants(
  entries: ConstantEntry[],
  builtins: ResolvedConstants = {},
): ResolvedConstants {
  const ctx: ResolvedConstants = { ...builtins }
  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry)) {
      if (typeof value === 'string' && value.trim().startsWith('#')) continue
      ctx[key] = evaluateExpression(value, ctx)
    }
  }
  return ctx
}

/**
 * Evaluate a single ScalarValue (number literal or string expression)
 * against a resolved constants map.
 */
export function evaluateExpression(value: ScalarValue, constants: ResolvedConstants): number {
  if (typeof value === 'number') return value

  const trimmed = value.trim()

  // Ternary: <expr> ? <trueVal> : <falseVal>
  const ternaryMatch = parseTernary(trimmed)
  if (ternaryMatch) {
    const { condition, ifTrue, ifFalse } = ternaryMatch
    return evaluateCondition(condition, constants)
      ? evaluateExpression(ifTrue, constants)
      : evaluateExpression(ifFalse, constants)
  }

  // Arithmetic expression — substitute variable names with their values
  return evaluateArithmetic(trimmed, constants)
}

// ─── Ternary parsing ─────────────────────────────────────────────────────────

interface TernaryParts {
  condition: string
  ifTrue: ScalarValue
  ifFalse: ScalarValue
}

/**
 * Split "condition ? ifTrue : ifFalse" — returns null if not a ternary.
 * Handles simple cases without nesting.
 */
function parseTernary(expr: string): TernaryParts | null {
  const qIdx = expr.indexOf('?')
  const cIdx = expr.lastIndexOf(':')
  if (qIdx === -1 || cIdx === -1 || cIdx < qIdx) return null

  const condition = expr.slice(0, qIdx).trim()
  const ifTrue = expr.slice(qIdx + 1, cIdx).trim()
  const ifFalse = expr.slice(cIdx + 1).trim()
  return { condition, ifTrue, ifFalse }
}

const COMPARISON_OPS = ['>=', '<=', '!=', '==', '>', '<'] as const
type ComparisonOp = (typeof COMPARISON_OPS)[number]

function evaluateCondition(condition: string, constants: ResolvedConstants): boolean {
  // || — lowest precedence: split and OR the sub-conditions
  const orParts = condition.split('||')
  if (orParts.length > 1) {
    return orParts.some(part => evaluateCondition(part.trim(), constants))
  }

  // && — higher precedence: split and AND the sub-conditions
  const andParts = condition.split('&&')
  if (andParts.length > 1) {
    return andParts.every(part => evaluateCondition(part.trim(), constants))
  }

  // Single comparison
  for (const op of COMPARISON_OPS) {
    const idx = condition.indexOf(op)
    if (idx === -1) continue
    const lhs = evaluateArithmetic(condition.slice(0, idx).trim(), constants)
    const rhs = evaluateArithmetic(condition.slice(idx + op.length).trim(), constants)
    return applyOp(op, lhs, rhs)
  }
  // Treat as truthy number
  return evaluateArithmetic(condition, constants) !== 0
}

function applyOp(op: ComparisonOp, a: number, b: number): boolean {
  switch (op) {
    case '>': return a > b
    case '<': return a < b
    case '>=': return a >= b
    case '<=': return a <= b
    case '==': return a === b
    case '!=': return a !== b
  }
}

// ─── Arithmetic ──────────────────────────────────────────────────────────────

/**
 * Evaluate a simple arithmetic expression that may reference named constants.
 * Substitutes identifiers with their numeric values, then parses the result.
 */
function evaluateArithmetic(expr: string, constants: ResolvedConstants): number {
  // Replace identifiers with their resolved numeric values.
  // Sort by length descending so longer names are matched before substrings.
  const sorted = Object.keys(constants).sort((a, b) => b.length - a.length)
  let substituted = expr
  for (const name of sorted) {
    // Match whole identifiers only (word boundary equivalent for alphanumeric+underscore)
    substituted = substituted.replace(
      new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g'),
      String(constants[name]),
    )
  }

  // After substitution the string should be a pure numeric arithmetic expression
  if (!/^[\d\s+\-*/().]+$/.test(substituted)) {
    throw new Error(`Cannot evaluate expression: "${expr}" → "${substituted}"`)
  }

  // Security: by this point all identifiers have been substituted with numeric literals.
  // The regex above guarantees `substituted` contains only digits, whitespace, and
  // arithmetic operators (+, -, *, /, ., parentheses). Any surviving identifier would
  // have triggered the throw above. Do NOT relax the regex without auditing for injection.
  return Function(`"use strict"; return (${substituted})`)() as number
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
