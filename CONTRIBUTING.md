# Guía de Contribución - Módulo de Enfermería

## 🎯 Cómo Contribuir

Gracias por tu interés en contribuir al módulo de enfermería de Med Solution. Esta guía te ayudará a empezar.

## 📋 Antes de Empezar

### Requisitos
- Conocimiento básico de Git
- Familiaridad con HTML, CSS y JavaScript
- Acceso al repositorio de Med Solution

### Configurar tu Entorno

```bash
# 1. Fork el repositorio
git clone https://github.com/TU_USERNAME/medsolution.git
cd medsolution

# 2. Crear rama de trabajo
git checkout -b feat/tu-mejora

# 3. Instalar dependencias (si aplica)
npm install
```

## 🛠️ Tipos de Contribuciones

### 1. Reportar Bugs

**Crear un Issue:**
1. Ve a [Issues](https://github.com/jsagitariom619/medsolution/issues)
2. Haz clic en "New Issue"
3. Completa el template:

```markdown
## Descripción
[Descripción clara del problema]

## Pasos para Reproducir
1. Haz esto
2. Luego esto
3. Entonces pasa esto

## Comportamiento Esperado
[Qué debería pasar]

## Comportamiento Actual
[Qué está pasando]

## Capturas de Pantalla
[Si es posible]

## Entorno
- Navegador: [Chrome, Firefox, etc.]
- Sistema Operativo: [Windows, macOS, Linux]
- Versión: [1.0.0]
```

### 2. Sugerir Mejoras

**Crear una Discussion:**
1. Ve a [Discussions](https://github.com/jsagitariom619/medsolution/discussions)
2. Abre un nuevo tema
3. Describe tu idea claramente

### 3. Enviar Pull Requests

**Proceso de PR:**

```bash
# 1. Hacer cambios
edit assets/css/nursing.css
edit assets/js/nursing.js

# 2. Commit con mensaje descriptivo
git add .
git commit -m "feat: descripción de tu cambio"

# 3. Push a tu fork
git push origin feat/tu-mejora

# 4. Abrir PR en GitHub
# Completa el template de PR
```

## 📝 Estándares de Código

### JavaScript

```javascript
// ✅ Bueno
const getNursingData = (specialty) => {
  return data[specialty] || [];
};

// ❌ Evitar
var getNursingData = function(specialty) {
  if (specialty in data) {
    return data[specialty];
  } else {
    return [];
  }
};
```

### CSS

```css
/* ✅ Bueno */
.nursing-table {
  width: 100%;
  border-collapse: collapse;
}

.nursing-table__row {
  border-bottom: 1px solid var(--border-color);
}

/* ❌ Evitar */
.table {
  width: 100%;
}

table tr {
  border-bottom: 1px solid #ddd;
}
```

### Nombres de Variables

```javascript
// ✅ Bueno
const injectableRecords = [];
const isModalOpen = false;

// ❌ Evitar
const inj_records = [];
const modal_open = false;
```

## 🧪 Testing

### Pruebas Manuales

Antes de enviar un PR, prueba:

- [ ] Todas las funcionalidades de CRUD
- [ ] Filtros en cada especialidad
- [ ] Búsqueda global
- [ ] Navegación entre pestañas
- [ ] Validación de formulario
- [ ] Responsive design
- [ ] Compatibilidad en navegadores

### Consola de Navegador

```javascript
// Verifica errores
F12 → Console

// Valida datos
console.log(nursingApp.data);

// Prueba funciones
nursingApp.addRecord('injectables', {...});
```

## 📚 Documentación

### Actualizar Documentación

Si cambias funcionalidades:

1. Actualiza `NURSING_MODULE.md`
2. Actualiza `CHANGELOG.md`
3. Añade comentarios en el código
4. Actualiza este archivo si es necesario

### Formato de Comentarios

```javascript
/**
 * Agrrega un nuevo registro de enfermería
 * @param {string} specialty - Tipo de especialidad
 * @param {object} data - Datos del registro
 * @returns {boolean} - Éxito de la operación
 */
const addRecord = (specialty, data) => {
  // Implementación
};
```

## 🔄 Workflow de Desarrollo

```
1. Fork → 2. Clone → 3. Branch → 4. Edit → 5. Test
    ↓                                        ↓
9. Merge ← 8. Review ← 7. Push ← 6. Commit
```

## 📋 Checklist para PRs

Antes de hacer push:

- [ ] Código sigue los estándares
- [ ] Sin errores en consola
- [ ] Tests pasan
- [ ] Documentación actualizada
- [ ] Commit messages son descriptivos
- [ ] Rama está actualizada con main
- [ ] Sin archivos innecesarios

## 🎨 Mejoras Sugeridas

### Fáciles (Buen Primer PR)
- Mejorar documentación
- Agregar comentarios
- Mejorar mensajes de error
- Optimizar estilos CSS

### Intermedias
- Nuevas especialidades
- Nuevos filtros
- Exportación a PDF
- Mejoras de UI/UX

### Avanzadas
- Integración Supabase
- Sistema de autenticación
- API REST
- Reportes avanzados

## 🏆 Reconocimientos

Todos los contribuidores son reconocidos en:
- GitHub (commits)
- [CONTRIBUTORS.md](CONTRIBUTORS.md)
- README.md

## 📜 Código de Conducta

Esperamos que todos los contribuidores:

- Sean respetuosos
- Proporcionen feedback constructivo
- Acepten críticas
- Enfoquen en lo mejor para el proyecto

## ❓ Preguntas?

- 💬 Abre una Discussion
- 🐛 Crea un Issue
- 📧 Contacta a jsagitariom619@gmail.com

---

¡Gracias por contribuir! 🎉
