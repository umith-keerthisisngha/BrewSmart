# Tea Grade Packing Density + Weight Range Update

- Grade Master now requires Packing Density, Minimum Bag Weight, and Maximum Bag Weight.
- Existing grades can be configured/updated from Grade Master.
- Invoice Entry only accepts a grade when Net Weight Each is inside that grade's configured range.
- Backend repeats the same validation for Turn Save, direct Invoice Save, Invoice Edit, and AI location recommendations.
- Existing grade records are not assigned invented values by the migration; configure them with your real warehouse values.

## Existing database
Import `database/migration_grade_density_weight_range_2026.sql`.
