

## Plan: Add "Atendimentos" shortcut to the welcome banner

The welcome banner (lines 184-203 in `src/pages/Dashboard.tsx`) currently has two buttons: "Nova OS" and "Chamados". We will add a third button for "Atendimentos" that navigates to `/daily-services`.

### Changes

**File: `src/pages/Dashboard.tsx`** (lines 200-203)

After the "Chamados" button, add a new button:

```tsx
<Button
  variant="secondary"
  size="sm"
  className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
  onClick={() => navigate('/daily-services')}
>
  <ClipboardList className="h-4 w-4 mr-1" />
  Atendimentos
</Button>
```

`ClipboardList` is already imported — no additional imports needed. This follows the exact same pattern as the existing buttons.

