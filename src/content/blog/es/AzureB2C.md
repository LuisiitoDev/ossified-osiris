---
title: 'Azure AD B2C: autenticación con Facebook y .NET'
description: 'Configurar políticas personalizadas de Azure AD B2C y autenticación mediante Facebook en aplicaciones .NET con Identity Experience Framework.'
pubDate: '2022-10-20'
updatedDate: '2026-10-31'
heroImage: '/img/AzureB2C/active-directory.jpeg'
tags: ['azure', 'azure-ad-b2c', 'identity', 'authentication']
lang: 'es'
---

> **Actualización de 2026 — para clientes actuales de Azure AD B2C:** Este artículo es una guía histórica publicada en 2022. Desde el **1 de mayo de 2025**, Azure AD B2C ya no está disponible para nuevos clientes. Los clientes existentes pueden seguir utilizándolo y Microsoft ha comprometido soporte al menos hasta **mayo de 2030**. Para nuevos proyectos de identidad de clientes, considerá [Microsoft Entra External ID](https://learn.microsoft.com/en-us/entra/external-id/customers/overview-customers-ciam). Las capturas, etiquetas y configuraciones siguientes reflejan la experiencia de 2022 y pueden diferir de la interfaz actual. Consultá las [preguntas frecuentes oficiales de Azure AD B2C](https://learn.microsoft.com/en-us/azure/active-directory-b2c/faq).

<h2 align="center">
    Azure Active Directory B2C: primera parte
</h2>

Azure Active Directory B2C (*Business to Consumer*) es un administrador de identidades que permite controlar cómo los usuarios se registran, inician sesión y gestionan sus perfiles desde diferentes plataformas, como Android, iOS y aplicaciones SPA.

En este artículo veremos cómo habilitar un flujo de autenticación con Azure AD B2C y Facebook e integrarlo en una aplicación .NET.

Seguiremos un flujo de políticas personalizadas descrito en Microsoft Learn.

## Configuración de la aplicación de Facebook

Primero debemos crear una aplicación de Facebook desde [Facebook for Developers](https://developers.facebook.com/apps).

Desde allí seguiremos estos pasos:

1. Creamos una aplicación.
    ![Creación de aplicación en Facebook](/img/AzureB2C/facebookapp.png)

2. Seleccionamos el tipo de aplicación. En este ejemplo, una aplicación para consumidores.
    ![Tipo de aplicación de Facebook](/img/AzureB2C/facebookapptype.png)

3. Ingresamos la información básica, como el nombre de la aplicación y el correo electrónico.
    ![Información básica de Facebook](/img/AzureB2C/facebookbasicinformation.png)

4. Después veremos la página de administración:
    ![Panel de Facebook Developers](/img/AzureB2C/facebookdashboard.png)

5. Copiamos el identificador de aplicación que nos proporciona Facebook.
    ![Identificador de aplicación de Facebook](/img/AzureB2C/facebookAppId.png)

Luego vamos a **Settings > Basic**, donde aparece la siguiente pantalla:

![Configuración básica de Facebook](/img/AzureB2C/facebooksettings.png)

Completamos estos campos:

* URL de la política de privacidad.
* URL de los términos del servicio.
* URL para la eliminación de datos de usuarios.
* Categoría de la aplicación.

También agregamos una plataforma desde la parte inferior de la página. Seleccionamos una plataforma web y configuramos la URL de nuestro sitio. Para este ejemplo utilicé localhost.

![Plataforma web de Facebook](/img/AzureB2C/facebookplatform.png)

Finalmente configuramos el producto **Facebook Login**.

![Configuración de Facebook Login](/img/AzureB2C/facebooklogin.png)

## Aprovisionamiento de Azure AD B2C

El siguiente paso es crear el recurso de Azure.

## Paso 1: crear un recurso de Azure Active Directory B2C

En el [Portal de Azure](https://portal.azure.com), buscamos `Azure Active Directory B2C` en el buscador de recursos:

![Buscar Azure AD B2C en el portal](/img/AzureB2C/azureADB2CRg.png)

Seleccionamos **Create**:

![Opción de creación de Azure AD B2C](/img/AzureB2C/azureadoption.png)

Luego elegimos crear un nuevo tenant, lo que nos lleva a la siguiente pantalla:

![Datos para crear el tenant de Azure AD B2C](/img/AzureB2C/informationazure.png)

Completamos:

* Nombre de la organización.
* Nombre del dominio.
* País del centro de datos (en este ejemplo, Estados Unidos).
* Suscripción de Azure.
* Grupo de recursos, nuevo o existente.

Por último seleccionamos **Review and create**.

## Paso 2: registrar las aplicaciones

Como utilizaremos Facebook para iniciar sesión, debemos registrar dos aplicaciones con estos nombres:

* `IdentityExperienceFramework`.
* `ProxyIdentityExperienceFramework`.

Para registrar una aplicación abrimos:

![Registro de aplicaciones](/img/AzureB2C/appregistration.png)

### Crear Identity Experience Framework

Seleccionamos **App registrations**:

![Inicio de un nuevo registro de aplicación](/img/AzureB2C/newapp.png)

Luego elegimos **New registration**:

![Formulario de registro de aplicación](/img/AzureB2C/appregistrations.png)

En el campo de nombre escribimos `IdentityExperienceFramework`. Después seleccionamos la opción de cuentas admitidas «Accounts in any identity provider or organizational directory» para los flujos de usuarios y la opción `offline_access` indicada en el ejemplo, y registramos la aplicación.

Al terminar veremos:

![Resumen de la aplicación registrada](/img/AzureB2C/overview.png)

### Autenticación

![Configuración de autenticación](/img/AzureB2C/authenticationFlow.png)

Aquí haremos lo siguiente:

1. Agregamos una plataforma de tipo **Web**.
2. Configuramos dos URI de redirección:
   - `https://jwt.ms`, para inspeccionar el token JWT.
   - `https://{your-tenant-name}.b2clogin.com/{your-tenant-name}.onmicrosoft.com`.

También debemos configurar estas opciones:

![Opciones adicionales de autenticación](/img/AzureB2C/auth2.png)

En **Implicit grant and hybrid flows**, activamos las dos casillas:

* Access Tokens.
* ID Tokens.

En **Advanced Settings**, establecemos **Enable the following mobile and desktop flows** en **Yes**, tal como indicaba la configuración histórica del tutorial.

### Exponer una API

![Permisos y ámbitos de la API](/img/AzureB2C/permissions.png)

Aquí configuramos los *scopes*, que delimitan la información o los permisos a los que una aplicación puede acceder en nombre del usuario.

Elegimos **Add a scope** y completamos:

1. Scope name.
2. Admin consent display name.
3. Admin consent description.
4. State.

Siguiendo el ejemplo de Microsoft Learn, utilizamos:

1. Scope name: `user_impersonation`.
2. Admin consent display name: `Access IdentityExperienceFramework`.
3. Admin consent description: `Allow the application to access IdentityExperienceFramework on behalf of the signed-in user.`
4. State: `true`.

Con esto terminamos la configuración de `IdentityExperienceFramework`.

### Crear Proxy Identity Experience Framework

Omitiremos los pasos repetidos para registrar la aplicación, ya que son los mismos de `IdentityExperienceFramework`. La diferencia se encuentra en estas opciones:

![Configuración de Proxy Identity Experience Framework](/img/AzureB2C/changes.png)

Seleccionamos:

* Public client/native.
* Redirect URI: `myapp://auth`.

### Permisos de API

![Permisos de API de la aplicación proxy](/img/AzureB2C/apipermission.png)

En esta pantalla agregaremos los permisos de la aplicación `ProxyIdentityExperienceFramework`.

Seleccionamos **Add a permission**:

![Solicitar permisos de API](/img/AzureB2C/requestApiPermissions.png)

Elegimos **My APIs**:

![Listado de APIs propias](/img/AzureB2C/myapis.png)

Seleccionamos `IdentityExperienceFramework`, la aplicación creada anteriormente:

![Permisos de Identity Experience Framework](/img/AzureB2C/identityframepermission.png)

Marcamos `user_impersonation`, el scope que creamos en la aplicación `IdentityExperienceFramework`, y presionamos **Add permissions**.

Así terminamos la configuración de la aplicación proxy.

## Paso 3: políticas

![Políticas personalizadas de Azure AD B2C](/img/AzureB2C/policies.png)

Agregaremos políticas personalizadas para el proveedor de identidad Facebook.

Configuraremos archivos XML y los subiremos a Azure para definir cómo debe integrarse la aplicación de Facebook. Esto permite solicitar permisos a los usuarios para acceder a determinada información y utilizar los tokens correspondientes.

### Crear las claves de firma y cifrado

![Claves de firma y cifrado](/img/AzureB2C/signingencription.png)

Seleccionamos **Add**:

![Crear clave](/img/AzureB2C/key.png)

Para la clave de firma, configuramos:

* Name: `TokenSigningKeyContainer`.
* Key type: RSA.
* Key usage: Signature.

Para la clave de cifrado:

* Name: `TokenEncryptionKeyContainer`.
* Key type: RSA.
* Key usage: Encryption.

En ambas seleccionamos la opción **Generate** y finalmente **Create**.

### Crear la clave para el secreto de Facebook

Cuando configuramos la aplicación de Facebook, la plataforma nos proporcionó un secreto de aplicación. Es necesario para establecer la conexión desde Azure, por lo que lo agregamos como secreto en B2C.

Seguimos un procedimiento similar al de las claves anteriores, con estas diferencias:

![Configuración del secreto de Facebook](/img/AzureB2C/facebooksecret.png)

* Options: Manual.
* Name: `FacebookSecret`.
* Secret: pegamos el secreto proporcionado por Facebook.
* Key usage: Signature.

Finalmente presionamos **Create**.

### Configuración XML de políticas personalizadas

Microsoft proporciona ejemplos en el repositorio [Custom Policy Starter Pack](https://github.com/Azure-Samples/active-directory-b2c-custom-policy-starterpack).

Para esta demostración utilizaremos los XML de la carpeta `SocialAndLocalAccounts`.

Como explica Microsoft Learn, debemos configurar el identificador de nuestra aplicación de Facebook en `TrustFrameworkExtensions.xml`:

```xml
<TechnicalProfile Id="Facebook-OAUTH">
  <Metadata>
  <!--Replace the value of client_id in this technical profile with the Facebook app ID"-->
    <Item Key="client_id">00000000000000</Item>
```

También debemos aplicar esta configuración adicional:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<TrustFrameworkPolicy 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
  xmlns="http://schemas.microsoft.com/online/cpim/schemas/2013/06" 
  PolicySchemaVersion="0.3.0.0" 
  TenantId="yourtenant.onmicrosoft.com" 
  PolicyId="B2C_1A_TrustFrameworkExtensions" 
  PublicPolicyUri="http://yourtenant.onmicrosoft.com/B2C_1A_TrustFrameworkExtensions">
```

Reemplazamos `yourtenant` por el nombre de nuestro tenant en los siguientes archivos:

* `TrustFrameworkBase.xml`.
* `TrustFrameworkLocalization.xml`.
* `TrustFrameworkExtensions.xml`.
* `SignUpOrSignin.xml`.
* `ProfileEdit.xml`.
* `PasswordReset.xml`.

Después cargamos los XML en Azure en el siguiente orden:

1. `TrustFrameworkBase.xml`.
2. `TrustFrameworkLocalization.xml`.
3. `TrustFrameworkExtensions.xml`.
4. `SignUpOrSignin.xml`.
5. `ProfileEdit.xml`.
6. `PasswordReset.xml`.

![Carga de políticas personalizadas](/img/AzureB2C/custompolicty.png)

## Paso 4: pruebas

![Configuración de prueba de políticas B2C](/img/AzureB2C/test1.png)

Para probar la configuración elegimos `B2C_1A_SIGNUPORSIGNIN`:

![Ejecutar prueba de política](/img/AzureB2C/runtest.png)

Seleccionamos `https://jwt.ms` como **Select reply URL** y presionamos **Run now**.

Al ejecutar el ejemplo veremos esta pantalla:

![Pantalla de inicio de sesión](/img/AzureB2C/login.png)

Ahora aparece la opción de iniciar sesión con Facebook. Al seleccionarla, Facebook pregunta si autorizamos a la aplicación a consultar datos como nombre y correo electrónico.

Una vez concedidos los permisos, la aplicación redirige a una pantalla donde podemos inspeccionar el token:

![Token JWT obtenido después de autenticarse](/img/AzureB2C/jwt.png)

Con esto terminamos esta primera parte, que resultó un poco extensa. 😅

¡Espero que te resulte útil! ¡Feliz programación! 🧑🏻‍💻 😁

### Referencias
* [Microsoft Learn (2022): políticas personalizadas en Azure AD B2C](https://learn.microsoft.com/en-us/azure/active-directory-b2c/tutorial-create-user-flows?pivots=b2c-custom-policy)
* [Microsoft Learn (2022): proveedor de identidad de Facebook](https://learn.microsoft.com/en-us/azure/active-directory-b2c/identity-provider-facebook?pivots=b2c-user-flow)
