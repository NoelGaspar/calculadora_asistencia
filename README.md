# Calculadora de Asistencia

App web estática que indica **hasta qué día debe asistir un estudiante** para cerrar el año con la asistencia mínima (85% por defecto).

## Cómo funciona

1. Ingresa al menos dos de: días de clases transcurridos, inasistencias, % de asistencia.
2. Ajusta la fecha de hoy, el último día de clases (por defecto 04-01-2027) y los feriados.
3. La app calcula:
   - Total de días del año = transcurridos + días hábiles restantes (lunes a viernes, sin feriados).
   - Faltas máximas = ⌊total × 15%⌋.
   - Margen = faltas máximas − inasistencias actuales.
   - Fecha límite = el día hábil restante número (restantes − margen).

## Publicar en GitHub Pages

```bash
git init
git add .
git commit -m "Calculadora de asistencia"
git branch -M main
git remote add origin https://github.com/<usuario>/calculadora-asistencia.git
git push -u origin main
```

Luego en GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
La app quedará en `https://<usuario>.github.io/calculadora-asistencia/`.
