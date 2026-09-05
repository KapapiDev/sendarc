export namespace main {
	
	export class AppSettings {
	    mode: string;
	    update_checks_enabled: boolean;
	    last_update_check?: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mode = source["mode"];
	        this.update_checks_enabled = source["update_checks_enabled"];
	        this.last_update_check = source["last_update_check"];
	    }
	}
	export class AuthStatus {
	    authenticated: boolean;
	    email?: string;
	    name?: string;
	
	    static createFrom(source: any = {}) {
	        return new AuthStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.authenticated = source["authenticated"];
	        this.email = source["email"];
	        this.name = source["name"];
	    }
	}
	export class ConnectionTestResult {
	    connected: boolean;
	    checkedAt: string;
	    message: string;

	    static createFrom(source: any = {}) {
	        return new ConnectionTestResult(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.checkedAt = source["checkedAt"];
	        this.message = source["message"];
	    }
	}
	export class MAPIStatus {
	    registered: boolean;
	    default: boolean;
	    dll64Present: boolean;
	    dll32Present: boolean;
	    healthy: boolean;
	    canRepair: boolean;
	    detail: string;

	    static createFrom(source: any = {}) {
	        return new MAPIStatus(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.registered = source["registered"];
	        this.default = source["default"];
	        this.dll64Present = source["dll64Present"];
	        this.dll32Present = source["dll32Present"];
	        this.healthy = source["healthy"];
	        this.canRepair = source["canRepair"];
	        this.detail = source["detail"];
	    }
	}
	export class ProductStatus {
	    gmail: AuthStatus;
	    mapi: MAPIStatus;
	    lastInterceptedAt?: string;
	    lastSuccessfulSend?: string;

	    static createFrom(source: any = {}) {
	        return new ProductStatus(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.gmail = this.convertValues(source["gmail"], AuthStatus);
	        this.mapi = this.convertValues(source["mapi"], MAPIStatus);
	        this.lastInterceptedAt = source["lastInterceptedAt"];
	        this.lastSuccessfulSend = source["lastSuccessfulSend"];
	    }

		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateState {
	    currentVersion: string;
	    latestVersion: string;
	    latestReleaseUrl: string;
	    installerUrl: string;
	    updateAvailable: boolean;
	    lastCheckedAt: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.latestReleaseUrl = source["latestReleaseUrl"];
	        this.installerUrl = source["installerUrl"];
	        this.updateAvailable = source["updateAvailable"];
	        this.lastCheckedAt = source["lastCheckedAt"];
	        this.enabled = source["enabled"];
	    }
	}

}

export namespace mapi {
	
	export class Attachment {
	    filename: string;
	    path: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Attachment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.path = source["path"];
	        this.size = source["size"];
	    }
	}
	export class Recipient {
	    name: string;
	    address: string;
	
	    static createFrom(source: any = {}) {
	        return new Recipient(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.address = source["address"];
	    }
	}
	export class Recipients {
	    to: Recipient[];
	    cc: Recipient[];
	    bcc: Recipient[];
	
	    static createFrom(source: any = {}) {
	        return new Recipients(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.to = this.convertValues(source["to"], Recipient);
	        this.cc = this.convertValues(source["cc"], Recipient);
	        this.bcc = this.convertValues(source["bcc"], Recipient);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MailMessage {
	    version: number;
	    interceptorVersion?: string;
	    hostVersion?: string;
	    timestamp: string;
	    subject: string;
	    body: string;
	    bodyFormat: string;
	    recipients: Recipients;
	    attachments: Attachment[];
	    originApp: string;
	
	    static createFrom(source: any = {}) {
	        return new MailMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.interceptorVersion = source["interceptorVersion"];
	        this.hostVersion = source["hostVersion"];
	        this.timestamp = source["timestamp"];
	        this.subject = source["subject"];
	        this.body = source["body"];
	        this.bodyFormat = source["bodyFormat"];
	        this.recipients = this.convertValues(source["recipients"], Recipients);
	        this.attachments = this.convertValues(source["attachments"], Attachment);
	        this.originApp = source["originApp"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EmailWithId {
	    id: string;
	    message?: MailMessage;
	
	    static createFrom(source: any = {}) {
	        return new EmailWithId(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.message = this.convertValues(source["message"], MailMessage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}
