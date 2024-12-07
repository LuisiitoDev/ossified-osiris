---
title: 'Azure AD B2C'
description: 'Azure Active Directory | Azure Entra'
pubDate: 'Oct 20 2022'
heroImage: '/img/AzureB2C/active-directory.jpeg'
---

<h2 align="center">
    Azure Active Directory B2C: Part I
</h2>

Azure Active Directory B2C (Business to Consumer) is an identity manager which allows to control how our users can sign up, sign in and control their profiles using any platform like Android, iOS, SPA (Single Web Application).

In this blog, we will look forward how to enable a flow authentication with Azure AD B2C and Facebook, and how to implemented in a .NET Application.

We will follow a custom policy flow explained in Microsoft Learn.

## Provisioning Facebook Application

First thing we have to do is to create a facebook application, to do it we have to go to this link [Facebook for Developers](https://developers.facebook.com/apps)

In this page we will do the next steps:

1. Create a new app: 
    ![result](/img/AzureB2C/facebookapp.png)

2. Select an app type, in this case we will select a consumer app
    ![result](/img/AzureB2C/facebookapptype.png)

3. Then we will provide a basic information like it could be our app name and email.
    ![result](/img/AzureB2C/facebookbasicinformation.png)

4. After that we will see the next page:
    ![result](/img/AzureB2C/facebookdashboard.png)

5. From this section we will need to copy the Application Id provided from Facebook.
    ![result](/img/AzureB2C/facebookAppId.png)


The next thing that we have to do in this page is the following, we will go to the settings > Basic section, and we will see the next page:

![result](/img/AzureB2C/facebooksettings.png)

In this page we will fill the next filds:

* Privacy Policy URL
* Terms of Service URL
* User Data Delection URL
* And select the category

Also we will add a plaform this section is in the bottom of the page, and we will add a web platform and set up the website our app. For this example we configured the localhost of our web.

![result](/img/AzureB2C/facebookplatform.png)

And finally we will configure a product, which we will use Facebook Login.

![result](/img/AzureB2C/facebooklogin.png)


## Provisioning Azure AD B2C

First thing that we have to do is to create a new resource.

## Step 1: Creating an Azure Active Directory B2C Resource

In [Azure Portal](https://portal.azure.com) in the resource input, wi will type 'Azure Active Directory B2C' to look for the Azure AD B2C, we will see the next section.

![result](/img/AzureB2C/azureADB2CRg.png)

We will hit the create button and we will see the next page:

![result](/img/AzureB2C/azureadoption.png)

And we will choose Create a new tenant. Once we choose the new tenant option we will see the next page:

![result](/img/AzureB2C/informationazure.png)

In this section we will fill the fields:

* Name of the organization
* Name of the domain
* Country of Data Center (by default is selected EEUU)
* Select our Azure Suscription
* Select or create our resource group.

For finish we will hit Review and Create Button.


## Step 2: Creating Applications

As we will use Facebook to Log In, we need to create two applications with the following names:

* IdentityExperienceFramework
* ProxyIdentityExperienceFramework

To create a new application we go to the next section:

![result](/img/AzureB2C/appregistration.png)

### Creating Identity Experience Framework

To create a new application, click over App Registration, you will see next page:

![result](/img/AzureB2C/newapp.png)

After we click over "New registration", we will see this page:

![result](/img/AzureB2C/appregistrations.png)

In the field name we will type Identity Experience Framework, then we choose "Accounts in any identity provider or organizational directory (for authenticating users with user flows)" and the permissions section we will select offiline_access and finally register.


After this process we will see the next page

![result](/img/AzureB2C/overview.png)

### Authentication

![result](/img/AzureB2C/authenticationFlow.png)

Here we will do a few things:

1. Add a platform as Web
2. Configure Redirect URIs, for this example we will add two:
    - https://jwt.ms (this is a page which allow us to decode a JWT Token)
    - https://{your-tenant-name}.b2clogin.com/{your-tenant-name}.onmicrosoft.com 

Another configuration that we have to do is:

![result](/img/AzureB2C/auth2.png)

In the "Implicit grant and hybrid flows" we need to check both options:

- Access Tokens
- Id Tokens

In the "Advanced Settings" we need to set in yes the opcion "Enable the following mobile and desktop flows" 

### Expose an API

![result](/img/AzureB2C/permissions.png)

In this section we will configure scopes, according to auth0 a scope decide which information you would like applications to be able to access on a user's behalf.

To add a scope we have to hit the Add a scope button, and this will show us a side page to enter the required information:
    
1. Scope name
2. Admin consent display name
3. Admin consent description
4. State

Following the example provided by Microsoft Learn, we set up the following configuration:

1. Scope name: user_impersonation
2. Admin consent display name: Access IdentityExperienceFramework
3. Admin consent description: Allow the application to access IdentityExperienceFramework on behalf of the signed-in user.
4. State: true


With this we have already finished the configuration of Identity Experience Framework.

### Creating Proxy Identity Experience Framework

We will skip the process to create the application, because it is the same process that we did in last part (Creating Identity Experience Framework), but we will do some changes below:

![result](/img/AzureB2C/changes.png)

We will choose:
- Public client/native
- Redirect URI: myapp://auth

### API Permissions

![result](/img/AzureB2C/apipermission.png)

In this page we will add permission for the app that we have created (Proxy Identity Experience Framework).

To add a permission, we hint the Add a permission button, and we will see the following page:

![result](/img/AzureB2C/requestApiPermissions.png)

In this page we will select "My APIs" and we will see this page:

![result](/img/AzureB2C/myapis.png)

We will select "IdentityExperienceFramework" which it is the previous application created.

Once we have selected we will see the next page:

![result](/img/AzureB2C/identityframepermission.png)

In this part we will select "user_impersonation", which its the scope that we created in Indetity Framework Experience application, and then we hit "Add permissions" button.

And with this we have already finished the configuration for Proxy Identity Framework Experience.


## Step 3: Policies

![result](/img/AzureB2C/policies.png)

In this section we will add custom policies for the identity provider (Facebook).

We will configure some XMLs and upload to Azure, to specify the configuration of the application that we have created in Facebook. With this Azure will know to request permission to the user for reading some information from Facebook and get the access tokens to use for authorization.

### Creating the signing key and encription key

![result](/img/AzureB2C/signingencription.png)

For creating both keys we will hit the "Add" button, and we will see the next page:

![result](/img/AzureB2C/key.png)

For signing key we will type and choose the next options:

- Name: TokenSigningKeyContainer
- Key type: RSA
- Key usage: Signature

For encription key we will type and choose the next options:

- Name: TokenEncryptionKeyContainer
- Key type: RSA
- Key usage: Encryption

For both key in the option section we will choose "Generate".

And finally "Create".

### Creating the key for Facebook Secret

When we were creating the Facebook application, Facebook provided us an application secret, this secret is required to connect with that application from Azure, for that reason we need to add it as a secret inside it.

We will follow the same steps of the previos section (Creating the signing key and encription key), with the follow difference:

![result](/img/AzureB2C/facebooksecret.png)

- Options: Manual
- Name: FacebookSecret
- Secret: we paste the secret got from Facebook
- Key usage: Signature

And finally "Create"

### XML Custom Policy Configuration

For this section Microsoft provide the following examples in the following repository: [Custom Policy Starter Pack](https://github.com/Azure-Samples/active-directory-b2c-custom-policy-starterpack).

For this section we will use the XMLs of the SocialAndLocalAccounts folder.

As Microsoft Learn explain we have to configure out Facebook application Id in the next XML: TrustFrameworkExtensions.xml

```xml
<TechnicalProfile Id="Facebook-OAUTH">
  <Metadata>
  <!--Replace the value of client_id in this technical profile with the Facebook app ID"-->
    <Item Key="client_id">00000000000000</Item>
```

In addition to this configuration we need to do the next configuration:

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
Replace "yourtenant" by your tenant name, we need to do for the next xmls:

- TrustFrameworkBase.xml
- TrustFrameworkLocalization.xml
- TrustFrameworkExtensions.xml
- SignUpOrSignin.xml
- ProfileEdit.xml
- PasswordReset.xml

Once we have configured this XMLs, we need to upload them to Azure in the following order:

1. TrustFrameworkBase.xml
2. TrustFrameworkLocalization.xml
3. TrustFrameworkExtensions.xml
4. SignUpOrSignin.xml
5. ProfileEdit.xml
6. PasswordReset.xml

![result](/img/AzureB2C/custompolicty.png)











## Step 4: Testing

![result](/img/AzureB2C/test1.png)

For testing our configuration we will choose the next configuration: B2C_1A_SIGNUPORSIGNIN, and we will see the page:

![result](/img/AzureB2C/runtest.png)

In this page we need select the https://jwt.ms url for Select reply url.

We will hit on Run now button.

Once we run the example we will see the next page:

![result](/img/AzureB2C/login.png)

As you see there is an option to Sign in/Login in with Facebook, if we click on Facebook button, Facebook will ask us if we grant permission to this app to access some information like name and email for example.

Finally we granted that permissions we will see the following page with the token information:

![result](/img/AzureB2C/jwt.png)


Well, with this we have finished this first part, a little bit large 😅.

I hope that it could be helpfull, Happy coding!!! 🧑🏻‍💻 😁


### References:
* Microsoft Learn (2022) https://learn.microsoft.com/en-us/azure/active-directory-b2c/tutorial-create-user-flows?pivots=b2c-custom-policy
* Microsoft Learn (2022) https://learn.microsoft.com/en-us/azure/active-directory-b2c/identity-provider-facebook?pivots=b2c-user-flow

