---
name: hyrr-validation
description: Use when adding or changing any form or request body in Hyrr (job posting, seeker profile, settings, dialogs, DTOs). Gives the paired frontend (zod) + backend (class-validator) rules, the structured salary/date inputs, and how errors reach the user inline.
---

# Form validation: same rules on both sides, errors on the field

Every user-editable value is validated twice with the **same rules and the same messages**:
1. **Frontend** before sending (instant, inline): zod schemas in `hyrr.shared/src/lib/validation.ts`.
2. **Backend** on every request (authoritative): class-validator DTOs, with shared helpers in
   `hyrr.backend/src/core/validation/structured.ts`.

When you change a rule, change both, and add a case to `src/core/validation/structured.spec.ts`.

## Never free text for structured values
| Value | UI | Stored as | Display text |
|---|---|---|---|
| Salary range (jobs, seeker expected salary) | `<SalaryRangeInput>`: currency select + min + max (numbers, thousands separators, the "–" is layout) + period chips | `salaryMin`, `salaryMax`, `salaryCurrency` (ISO 4217 from `CURRENCIES`), `salaryPeriod` (`YEAR`/`MONTH`/`HOUR`) | server builds `salary` / `expectedSalary`: "USD 120,000 – 150,000 / year" |
| Work experience dates | `<MonthRangeInput>` (month + year selects, "I currently work here") | `startDate`/`endDate` ("YYYY-MM" in the API, first-of-month DateTime in DB), `current` | server builds `duration`: "Mar 2021 – Present" |
| Education years | `<YearRangeInput>` | `startYear`, `endYear` (null = still studying) | server builds `duration`: "2015 – 2019" |
| Years of experience | `<select>` 0–19, "20+" | string | — |
| Enumerations (type, currency, period, visibility) | `<select>` / chips | enum / `IsIn` | — |

Display strings (`salary`, `expectedSalary`, `duration`) are **outputs only**; DTOs don't accept them
(legacy `duration` is optional and ignored when dates are sent).

## Rules that must hold
- **All-or-nothing groups:** salary min, max, currency and period come together, or all null to clear
  (backend: `RequiredWith` + `IfGroupPresent`; frontend: `salaryRangeSchema`).
- **Cross-field order:** max ≥ min, end ≥ start (`IsGreaterOrEqualTo`; "YYYY-MM" compares as text).
- **No future starts:** experience start/end ≤ current month (`IsNotFutureMonth`); education start ≤
  this year, end ≤ this year + 8.
- **Integers only for money**, 0 … 100,000,000. No currency symbols in numbers.
- **Trim then require:** `@Transform(trimString)` + `@IsNotEmpty({ message })` (backend);
  `z.string().trim().min(1, msg)` (frontend).
- **Bounded everything:** `MaxLength` on strings, `ArrayMaxSize` on lists (skills 50, languages 20,
  locations 10, experiences 30, educations 20, job skills/requirements 30).
- **Every decorator gets a human message** (it is shown to users verbatim).

## How errors reach the user
- Backend: the global `ValidationPipe` uses `validationException`
  (`src/core/validation/validation-errors.ts`) → 400 `VALIDATION_FAILED` with
  `fields: { "experiences.0.endDate": "End month can't be before the start month" }` (first message
  per field) plus `details` (the message list).
- Frontend: `ApiError.fields`; read with `fieldErrorsOf(err)`. Map DTO names to form keys when they
  differ (`salaryMin` → `salary.min`, `expectedSalaryMax` → `salary.max`).
- Show errors **under the field** with `<FieldError id="x-error" message=... />`; give the control
  `aria-invalid` and `aria-describedby="x-error"`. Clear a field's error when it changes. On submit,
  focus the first invalid field. Toasts are only for non-field failures (network, 5xx, permission).
- Nested forms: keep one `errors: FieldErrors` object with dotted keys and pass slices with
  `scopeErrors(errors, "salary")` / `scopeErrors(errors, \`experiences.${i}\`)`.

## Recipe: new form
1. Add/extend the zod schema in `lib/validation.ts` (messages identical to the DTO).
2. DTO: class-validator with messages; cross-field helpers from `structured.ts`.
3. Form: `const [errors, setErrors] = useState<FieldErrors>({})`; on submit
   `const found = validate(schema, values)`; `setErrors(found)`; stop if non-empty.
4. On API error: `fieldErrorsOf(err)` → `setErrors(mapped)`; else toast.
5. Tests: a DTO case in `structured.spec.ts` (valid, each invalid branch).
