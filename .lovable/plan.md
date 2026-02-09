
# Admin Panel pro editaci tréninků + Oprava fází cviků (warmup/cooldown)

## Co se změní

### A. Oprava kategorizace fází cviků v databázi

Aktuálně jsou všechny cviky bez `primary_role` označeny jako `allowed_phase = 'warmup'`, ale ve skutečnosti:

- **Kardio cviky** (68 ks, category='cardio') = skutečný **warmup** (rozehřátí celého těla)
- **Stretche a mobilita** (102 abdominals + 23 shoulders + 16 legs + 2 back = 143 ks) = **cooldown** (po hlavním tréninku)

Migrace přidá novou hodnotu `cooldown` do `allowed_phase` a přeřadí stretche/mobilitu:

```sql
UPDATE exercises 
SET allowed_phase = 'cooldown' 
WHERE primary_role IS NULL 
  AND allowed_phase = 'warmup' 
  AND category != 'cardio';
```

Warmup generátor pak bude vybírat jen kardio cviky (celotělové rozehřátí), a v budoucnu se přidá cooldown fáze s protahovacími cviky.

Zbývajících **20 hlavních cviků** bez `primary_role` (allowed_phase='main') potřebuje ruční opravu -- ty uvidíš v diagnostice.

### B. Nové admin stránky

#### 1. Editace Day Templates (`/admin/templates`)

Stránka pro správu tréninkových šablon -- jaké role jsou v kterém dni, kolik sérií a opakování. Seskupeno podle split typu.

Funkce:
- Zobrazení šablon seskupených podle split_type (FB_AB, UL_AB, PPL_ABC) a day_letter (A, B, C)
- Editace slotů: role_id, beginner/intermediate/advanced sets, rep_min, rep_max
- Přidání a odebrání slotů
- Vizuální přehled struktury každého dne

#### 2. Editace Training Roles (`/admin/roles`)

Stránka pro správu tréninkových rolí s jejich metadaty.

Funkce:
- Editace `allowed_equipment_categories` (machine, cable, barbell, dumbbell...)
- Editace `banned_injury_tags` (shoulder, knees, lower_back...)
- Editace `difficulty_level` a `phase_type`
- Zobrazení napojených svalů z `role_muscles`

#### 3. Diagnostická karta na Dashboard

Na hlavní admin dashboard přidáme kartu "Kvalita dat":
- Počet hlavních cviků bez primary_role (aktuálně 20)
- Počet cviků bez videa
- Počet strojů bez napojených cviků
- Počet rolí s prázdnými `allowed_equipment_categories`

### C. RLS migrace

Přidání admin-only INSERT/UPDATE/DELETE policies pro tabulky:
- `day_templates`
- `training_roles`
- `role_muscles`

## Technické detaily

### Databázová migrace

```sql
-- 1. Cooldown fáze pro stretche
UPDATE exercises 
SET allowed_phase = 'cooldown' 
WHERE primary_role IS NULL AND allowed_phase = 'warmup' AND category != 'cardio';

-- 2. RLS pro day_templates (admin CRUD)
CREATE POLICY "Admins can insert day_templates" ON day_templates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update day_templates" ON day_templates FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete day_templates" ON day_templates FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- 3. RLS pro training_roles (admin CRUD)
CREATE POLICY "Admins can insert training_roles" ON training_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update training_roles" ON training_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete training_roles" ON training_roles FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- 4. RLS pro role_muscles (admin CRUD)
CREATE POLICY "Admins can insert role_muscles" ON role_muscles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update role_muscles" ON role_muscles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete role_muscles" ON role_muscles FOR DELETE USING (has_role(auth.uid(), 'admin'));
```

### Nové soubory

| Soubor | Popis |
|--------|-------|
| `src/pages/admin/DayTemplatesManagement.tsx` | Editace tréninkových šablon |
| `src/pages/admin/TrainingRolesManagement.tsx` | Editace tréninkových rolí |

### Upravené soubory

| Soubor | Změna |
|--------|-------|
| `src/pages/admin/AdminLayout.tsx` | 2 nové nav položky (Šablony, Role) |
| `src/App.tsx` | 2 nové admin routes |
| `src/pages/admin/Dashboard.tsx` | Diagnostická karta |

### Navigace admin panelu (rozšířená)

Stávající: Dashboard, Uživatelé, Posilovny, Stroje, Cviky, Přeskočené, User FB

Nové: + **Šablony**, + **Role**
