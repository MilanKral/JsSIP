
/**
 * @fileoverview DigestAuthentication
 */

/**
 * SIP Digest Authentication.
 * @augments JsSIP.
 * @function Digest Authentication
 * @param {JsSIP.UA} ua
 * @param {JsSIP.OutgoingRequest} request
 * @param {JsSIP.IncomingResponse} response
 */
JsSIP.DigestAuthentication = function (ua, request, response) {
  var authenticate,
    username = ua.configuration.authorization_user,
    password = ua.configuration.password;

  if(response.status_code === 401) {
    authenticate = response.parseHeader('www-authenticate');
  } else {
    authenticate = response.parseHeader('proxy-authenticate');
  }

  // TODO: Some required params should be checked here, and ABORT if not present.
  // NOTE: "ABORT" means "raising something so the method caller catches it and abort the authentication attempt".

  this.username = username;
  this.password = password;
  this.method   = request.method;
  this.realm = authenticate.realm;
  this.nonce = authenticate.nonce;
  this.uri = request.ruri;
  this.algorithm = authenticate.algorithm; // TODO: Check that authenticate.algorithm === 'MD5' (ABORT otherwise).
  this.opaque = authenticate.opaque;
  this.response = null;
  this.cnonce = null;
  this.nc = 0;
  this.ncHex = '00000000';

  // 'qop' can contain a list of values (Array). Let's choose just one.
  if (authenticate.qop) {
    if (authenticate.qop.indexOf('auth') > -1) {
      this.qop = 'auth';
    } else if (authenticate.qop.indexOf('auth-int') > -1) {
      this.qop = 'auth-int';
    } else {
      // TODO: Otherwise 'qop' is present but does not contain 'auth' or 'auth-int', so we should ABORT here!
      this.qop = undefined;
    }
  } else {
    this.qop = null;
  }
};

JsSIP.DigestAuthentication.prototype.authenticate = function(password) {
  var ha1, ha2;

  password = password || this.password;

  this.cnonce = JsSIP.Utils.createRandomToken(12);
  this.nc += 1;
  this.updateNcHex();

  // nc-value = 8LHEX. Max value = 'FFFFFFFF'
  if (this.nc === 4294967296) {
    console.log(JsSIP.C.LOG_DIGEST_AUTHENTICATION + 'maximum "nc" value has been reached, resetting "nc"');
    this.nc = 1;
    this.ncHex = '00000001';
  }

  // HA1 = MD5(A1) = MD5(username:realm:password)
  ha1 = JsSIP.Utils.MD5(this.username + ":" + this.realm + ":" + password);

  if (this.qop === 'auth') {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = JsSIP.Utils.MD5(this.method + ":" + this.uri);
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = JsSIP.Utils.MD5(ha1 + ":" + this.nonce + ":" + this.ncHex + ":" + this.cnonce + ":auth:" + ha2);

  } else if (this.qop === 'auth-int') {
    // HA2 = MD5(A2) = MD5(method:digestURI:MD5(entityBody))
    ha2 = JsSIP.Utils.MD5(this.method + ":" + this.uri + ":" + JsSIP.Utils.MD5(this.body ? this.body : ""));
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = JsSIP.Utils.MD5(ha1 + ":" + this.nonce + ":" + this.ncHex + ":" + this.cnonce + ":auth-int:" + ha2);

  } else if (this.qop === null) {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = JsSIP.Utils.MD5(this.method + ":" + this.uri);
    // response = MD5(HA1:nonce:HA2)
    this.response = JsSIP.Utils.MD5(ha1 + ":" + this.nonce + ":" + ha2);
  }

  return this.toString();
};


JsSIP.DigestAuthentication.prototype.update = function(response) {
  var authenticate, nonce;

  if(response.status_code === 401) {
    authenticate = response.parseHeader('www-authenticate');
  } else {
    authenticate = response.parseHeader('proxy-authenticate');
  }

  // TODO: Some required params (as nonce, realm....) should be checked here, and ABORT if not present.

  nonce = authenticate.nonce;

  if(nonce !== this.nonce) {
    this.nc = 0;
    this.ncHex = '00000000';
    this.nonce = nonce;
  }

  this.realm = authenticate.realm;
  this.opaque = authenticate.opaque;

  // 'qop' can contain a list of values (Array). Let's choose just one.
  if (authenticate.qop) {
    if (authenticate.qop.indexOf('auth') > -1) {
      this.qop = 'auth';
    } else if (authenticate.qop.indexOf('auth-int') > -1) {
      this.qop = 'auth-int';
    } else {
      // TODO: Otherwise 'qop' is present but does not contain 'auth' or 'auth-int', so we should ABORT here!
      this.qop = undefined;
    }
  } else {
    this.qop = null;
  }
};


JsSIP.DigestAuthentication.prototype.toString = function() {
  var auth_params = [];

  if (this.algorithm) {
    auth_params.push('algorithm=' + this.algorithm);
  }
  if (this.username) {
    auth_params.push('username="' + this.username + '"');
  }
  if (this.realm) {
    auth_params.push('realm="' + this.realm + '"');
  }
  if (this.nonce) {
    auth_params.push('nonce="' + this.nonce + '"');
  }
  if (this.uri) {
    auth_params.push('uri="' + this.uri + '"');
  }
  if (this.response) {
    auth_params.push('response="' + this.response + '"');
  }
  if (this.opaque) {
    auth_params.push('opaque="' + this.opaque + '"');
  }
  if (this.qop) {
    auth_params.push('qop=' + this.qop);
    auth_params.push('cnonce="' + this.cnonce + '"');
    auth_params.push('nc=' + this.ncHex);
  }

  return 'Digest ' + auth_params.join(', ');
};


/**
* Generate the 'nc' value as required by Digest in this.ncHex by reading this.nc.
* @private
*/
JsSIP.DigestAuthentication.prototype.updateNcHex = function() {
  var hex = Number(this.nc).toString(16);
  this.ncHex = '00000000'.substr(0, 8-hex.length) + hex;
};
