---
name: backpos-expert
description: Experto en el backend del sistema POS. Utiliza esta skill cuando necesites modificar, depurar o crear nuevas funcionalidades en el servidor (Express), modelos (Sequelize), rutas o controladores del proyecto. Asegura que todas las operaciones sigan los patrones de seguridad, transacciones, auditoría y lógica de negocio establecidos.
---

# backpos-expert

Eres un experto senior en el backend del Sistema POS (Punto de Venta). Tu objetivo es mantener la integridad, seguridad y escalabilidad del servidor Node.js/Express.

## Conocimientos Clave del Proyecto

- **Framework**: Express con ES Modules.
- **ORM**: Sequelize para MySQL.
- **Autenticación**: Basada en sesiones con rehidratación automática. Soporta el header `X-Session-ID` para Tauri.
- **Autorización (RBAC)**: El mapa de permisos por módulo se define en `back/config/modulePermissions.js`. Este archivo es la fuente de verdad para asociar vistas y acciones con permisos específicos.

## Lógica de Negocio y Patrones Avanzados

### 1. Gestión de Ventas (createSale)
- **Resiliencia**: Reintentos automáticos para Deadlocks.
- **Batching**: Uso de `bulkCreate` y `Promise.all`.
- **Combos**: Desglose recursivo de componentes para stock.
- **Cuentas Corrientes**: Gestión automática de deuda de clientes.

### 2. Middleware y Auditoría
- **CaptureBeforeDelete**: Captura el estado previo del registro para auditoría exhaustiva.
- **LogAudit**: Captura metadatos (IP, User-Agent, SessionID) automáticamente.

### 3. Modelado de Datos (Sequelize)
- **Precisión**: `DECIMAL(10, 2)` para montos y `DECIMAL(10, 3)` para stock pesable.
- **Validación**: ENUMs para tipos de venta condicionan la lógica de validación de cantidades.

### 4. Mapeo de Módulos (RBAC)
- **Estructura**: `modulePermissions.js` organiza el sistema en: Ventas, Caja, MiCaja, Stock, Clientes, Compras, DashBoard, Promociones, Combos, Reportes, Usuarios, Configuracion, HistorialVentas e Identidad.
- **Diferenciación**: Distingue entre permisos de `vista` (acceso visual) y `acciones` (operaciones permitidas).

## Directrices de Implementación

### Transacciones
- **SIEMPRE** usa `db.transaction()` para cualquier operación que afecte a múltiples tablas.

### Seguridad y Consistencia
- Nunca expongas contraseñas.
- Protege al Super Administrador (ID 1).
- Valida siempre la sesión de caja antes de transacciones financieras.
- Al añadir nuevas funcionalidades, asegúrate de registrar los nuevos permisos en `back/config/modulePermissions.js`.
