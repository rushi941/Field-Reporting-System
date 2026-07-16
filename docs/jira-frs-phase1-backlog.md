# FRS Phase 1 — Jira Master Backlog

**Estimate rule:** each **Task** = **8 hours** (1 day).  
**Split rule:** Frontend and Backend are **separate tasks**.  
**Use:** create Epics first → Stories → Tasks (or import the CSV).

---

## Epic summary

| Epic key (suggested) | Epic name | Stories | Tasks (8h) | Total hours |
|----------------------|-----------|---------|------------|-------------|
| FRS-E1 | Auth & Session | 2 | 4 | 32 |
| FRS-E2 | Users & Permissions | 3 | 6 | 48 |
| FRS-E3 | Project Types Master | 2 | 4 | 32 |
| FRS-E4 | Bid Master (Tasks) | 3 | 6 | 48 |
| FRS-E5 | Projects Workspace | 4 | 8 | 64 |
| FRS-E6 | Field Reporting | 5 | 10 | 80 |
| FRS-E7 | Manager Approvals | 4 | 8 | 64 |
| FRS-E8 | Billing & Office | 3 | 6 | 48 |
| FRS-E9 | Shared Platform (API/DB/Zod) | 3 | 4 | 32 |
| FRS-E10 | Deploy & Environments | 2 | 4 | 32 |
| FRS-E11 | UX Polish & Modals | 2 | 3 | 24 |
| | **TOTAL** | **33** | **63** | **504h** |

---

## FRS-E1 — Auth & Session

### FRS-S1.1 Login & JWT
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T1.1.1 | Task | [BE] Auth login/logout/me + JWT issue/verify | Backend | 8 |
| T1.1.2 | Task | [FE] Login page form (email/password, show/hide) | Frontend | 8 |

### FRS-S1.2 Role home routing
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T1.2.1 | Task | [BE] Return roles + effective permissions on login/me | Backend | 8 |
| T1.2.2 | Task | [FE] Role-based redirect + protected routes + layouts | Frontend | 8 |

---

## FRS-E2 — Users & Permissions

### FRS-S2.1 User CRUD
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T2.1.1 | Task | [BE] Users list/create/update/deactivate APIs | Backend | 8 |
| T2.1.2 | Task | [FE] Users page (create/edit, roles only, status toggle + confirm) | Frontend | 8 |

### FRS-S2.2 Permission matrix
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T2.2.1 | Task | [BE] Permission catalog + role matrix GET/PUT | Backend | 8 |
| T2.2.2 | Task | [FE] System permissions matrix UI (Yes/No) | Frontend | 8 |

### FRS-S2.3 Seed & admin bootstrap
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T2.3.1 | Task | [BE] Admin-only seed + permission seed for Neon/prod | Backend | 8 |
| T2.3.2 | Task | [FE] Overview cards copy aligned to users/roles (no division/manager) | Frontend | 8 |

---

## FRS-E3 — Project Types Master

### FRS-S3.1 Project types CRUD
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T3.1.1 | Task | [BE] Project types list/create/update APIs | Backend | 8 |
| T3.1.2 | Task | [FE] Project types workspace page | Frontend | 8 |

### FRS-S3.2 Division linkage
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T3.2.1 | Task | [BE] Division enum validation on project types | Backend | 8 |
| T3.2.2 | Task | [FE] Division selectors + labels on type forms | Frontend | 8 |

---

## FRS-E4 — Bid Master (Tasks)

### FRS-S4.1 Master & sub-bids
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T4.1.1 | Task | [BE] Task master CRUD + parent/child hierarchy | Backend | 8 |
| T4.1.2 | Task | [FE] Bid master UI (expand tree, master/sub create-edit) | Frontend | 8 |

### FRS-S4.2 CSV import
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T4.2.1 | Task | [BE] Bid/task CSV import endpoint + validation | Backend | 8 |
| T4.2.2 | Task | [FE] CSV import modal on bid master page | Frontend | 8 |

### FRS-S4.3 Unsaved close on bid forms
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T4.3.1 | Task | [FE] Bid modal X close + unsaved Save/Discard dialog | Frontend | 8 |
| T4.3.2 | Task | [BE] Harden task update validation / conflict responses | Backend | 8 |

---

## FRS-E5 — Projects Workspace

### FRS-S5.1 Project CRUD
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T5.1.1 | Task | [BE] Projects list/create/update + lookups (PM list) | Backend | 8 |
| T5.1.2 | Task | [FE] Projects list + create/edit modal (PM, division, dates) | Frontend | 8 |

### FRS-S5.2 Auto job number & optional route
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T5.2.1 | Task | [BE] Auto JOB-YYYY-NNNN allocation; route optional | Backend | 8 |
| T5.2.2 | Task | [FE] Optional job # placeholder; optional map route picker | Frontend | 8 |

### FRS-S5.3 Project delete
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T5.3.1 | Task | [BE] DELETE project (block if reports exist) | Backend | 8 |
| T5.3.2 | Task | [FE] Delete icon + confirm popup + toast | Frontend | 8 |

### FRS-S5.4 Project detail tasks
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T5.4.1 | Task | [BE] Project detail + create project task API | Backend | 8 |
| T5.4.2 | Task | [FE] Project detail + create task modal (X + unsaved + Save changes) | Frontend | 8 |

---

## FRS-E6 — Field Reporting

### FRS-S6.1 Field project search
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T6.1.1 | Task | [BE] Field projects list/search scoped to lead | Backend | 8 |
| T6.1.2 | Task | [FE] Field projects list + search UI | Frontend | 8 |

### FRS-S6.2 Task entry & draft
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T6.2.1 | Task | [BE] Draft report create/update + line items from tasks | Backend | 8 |
| T6.2.2 | Task | [FE] Task entry form (STA/manual/single, CF autofill) | Frontend | 8 |

### FRS-S6.3 Attachments
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T6.3.1 | Task | [BE] Attachment upload (local storage) + serve /uploads | Backend | 8 |
| T6.3.2 | Task | [FE] Photo upload on task entry + preview | Frontend | 8 |

### FRS-S6.4 Submit & lock
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T6.4.1 | Task | [BE] Submit report + lock + audit SUBMITTED | Backend | 8 |
| T6.4.2 | Task | [FE] Sticky Save + Submit footer; returned edit flow | Frontend | 8 |

### FRS-S6.5 Field report list/detail
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T6.5.1 | Task | [BE] Field report list/detail + return actor from audit | Backend | 8 |
| T6.5.2 | Task | [FE] Field reports list + detail (lines, notes, approved/returned by) | Frontend | 8 |

---

## FRS-E7 — Manager Approvals

### FRS-S7.1 Pending queue
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T7.1.1 | Task | [BE] Pending queue + summary count + age helpers | Backend | 8 |
| T7.1.2 | Task | [FE] Approvals queue UI + pending badge + age chips | Frontend | 8 |

### FRS-S7.2 Approve / return
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T7.2.1 | Task | [BE] Approve, approve-with-notes, return + audit | Backend | 8 |
| T7.2.2 | Task | [FE] Approval detail actions + mandatory return comment | Frontend | 8 |

### FRS-S7.3 Project history
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T7.3.1 | Task | [BE] Manager project history + projects picker API | Backend | 8 |
| T7.3.2 | Task | [FE] Project history page | Frontend | 8 |

### FRS-S7.4 Approvals shell
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T7.4.1 | Task | [FE] Approvals layout (Div. Manager label, nav, badge) | Frontend | 8 |
| T7.4.2 | Task | [BE] Manager scope filtering (managerId / division / admin) | Backend | 8 |

---

## FRS-E8 — Billing & Office

### FRS-S8.1 Rollup dashboard
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T8.1.1 | Task | [BE] Billing rollup metrics (approved/pending counts) | Backend | 8 |
| T8.1.2 | Task | [FE] Office/system overview + billing rollup page | Frontend | 8 |

### FRS-S8.2 Drilldown
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T8.2.1 | Task | [BE] Project billing drilldown (approved detail only) | Backend | 8 |
| T8.2.2 | Task | [FE] Billing drilldown page | Frontend | 8 |

### FRS-S8.3 CSV export
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T8.3.1 | Task | [BE] Billing CSV export + EXPORTED audit | Backend | 8 |
| T8.3.2 | Task | [FE] Export download action from rollup/drilldown | Frontend | 8 |

---

## FRS-E9 — Shared Platform

### FRS-S9.1 Prisma schema & migrations
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T9.1.1 | Task | [BE] Prisma models + migrations for all masters/reports | Backend | 8 |

### FRS-S9.2 Shared Zod schemas
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T9.2.1 | Task | [BE/Shared] Zod schemas (auth, users, projects, reports, STA) | Backend | 8 |
| T9.2.2 | Task | [FE] Wire forms to shared Zod (RHF resolvers) | Frontend | 8 |

### FRS-S9.3 RBAC middleware
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T9.3.1 | Task | [BE] requireAuth + requirePermission on all protected routes | Backend | 8 |

---

## FRS-E10 — Deploy & Environments

### FRS-S10.1 Render production start
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T10.1.1 | Task | [BE] Root start/build, serve web from API public, migrate on start | Backend | 8 |
| T10.1.2 | Task | [FE] Production static build + copy-to-api pipeline | Frontend | 8 |

### FRS-S10.2 Neon database
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T10.2.1 | Task | [BE] Neon DATABASE_URL, migrate deploy, admin seed script | Backend | 8 |
| T10.2.2 | Task | [FE] Env docs / production CORS same-origin smoke check | Frontend | 8 |

---

## FRS-E11 — UX Polish & Modals

### FRS-S11.1 Login design polish
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T11.1.1 | Task | [FE] Login page layout/clarity (same brand colors) | Frontend | 8 |

### FRS-S11.2 Unsaved close pattern
| Key | Type | Summary | Layer | Hours |
|-----|------|---------|-------|-------|
| T11.2.1 | Task | [FE] Shared UnsavedCloseDialog + project/task modal X | Frontend | 8 |
| T11.2.2 | Task | [FE] Edit buttons label “Save changes”; confirm dialogs (user status) | Frontend | 8 |

---

## Suggested Jira setup

1. **Project:** FRS (or Field Reporting System)  
2. **Issue types:** Epic → Story → Task  
3. **Components:** `frontend`, `backend`, `shared`, `devops`  
4. **Labels:** `phase-1`, `auth`, `field`, `approvals`, `billing`, `masters`  
5. **Estimate field:** Original Estimate = `8h` on every Task  
6. **Assignee board columns:** To Do / In Progress / Review / Done  

### Naming convention
```
[FE] Short action — module
[BE] Short action — module
```

### Sprint sizing tip
- **1 sprint (2 weeks, 1 FE + 1 BE)** ≈ **10 tasks** (80h) if fully dedicated  
- Full backlog **504h** ≈ **6–7 sprints** with 1 FE + 1 BE

---

## Out of scope (do not create Phase 1 tasks)
- Escalation threshold / overdue alerts (removed)
- Foundation live API write-back
- Native mobile apps
- S3 production storage (local uploads only for Phase 1)
- SMS / advanced PDF / payroll
