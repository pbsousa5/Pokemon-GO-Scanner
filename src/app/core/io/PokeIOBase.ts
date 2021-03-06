import request = require("request");
import q = require("q");

import {Logger} from "../helpers/Logger";
import {ProtoBuilder} from "../proto/ProtoBuilder";
import {Player} from "../models/Player";
import {Auth} from "../auth/Auth";
import {Constants} from "./Constants";
import {ApiHandler} from "./handlers/ApiHandler";
import {GeocoderHelper} from "../helpers/GeocoderHelper";
import {ErrorHandler} from "./handlers/ErrorHandler";
import {PlayerProfile} from "../models/PlayerProfile";

var api_url = "https://pgorelease.nianticlabs.com/plfe/rpc";

export abstract class PokeIOBase
{
    public player:Player;

    public requestEnvelope;
    public responseEnvelope;

    constructor()
    {
        this.player = new Player();

        // Build proto
        var proto = ProtoBuilder.buildPokemonProto();
        this.requestEnvelope = proto.request;
        this.responseEnvelope = proto.response;
    }

    public async init(username:string, password:string, location:string, provider:string)
    {
        // Set provider
        this.player.provider = provider;

        // Updating location
        this.player.location = await GeocoderHelper.resolveLocationByName(location);

        // Getting access token
        this.player.accessToken = await Auth.getAccessToken(username, password, provider);

        // Getting api endpoint
        this.player.apiEndpoint = await this.getApiEndpoint();
    }

    public async getApiEndpoint():Promise<string>
    {
        var requestEnvelope = this.requestEnvelope;

        var requests = [
            new requestEnvelope.Requests(2),
            new requestEnvelope.Requests(126),
            new requestEnvelope.Requests(4),
            new requestEnvelope.Requests(129),
            new requestEnvelope.Requests(5)
        ];

        var apiResponse = await this.makeApiRequest(Constants.API_URL, requests) as any;

        var apiUrl = apiResponse.api_url;

        if(!apiUrl)
        {
            ErrorHandler.throwRPCOfflineError();
        }

        var endpoint = `https://${apiResponse.api_url}/rpc`;

        Logger.debug("Received API Endpoint: " + endpoint);

        return endpoint;
    };

    public makeApiRequest(endpoint:string, requests:any[])
    {
        var def = q.defer();

        // Auth
        var auth = new this.requestEnvelope.AuthInfo({
            provider: this.player.provider,
            token: new this.requestEnvelope.AuthInfo.JWT(this.player.accessToken, 59)
        });

        var request = new this.requestEnvelope({
            requests: requests,

            latitude: this.player.location.latitude,
            longitude: this.player.location.longitude,

            unknown1: 2,
            rpc_id: 1469378659230941192,

            auth: auth,
            unknown12: 989
        });

        var protobuf = request.encode().toBuffer();

        var options = {
            url: endpoint,
            body: protobuf,
            encoding: null,
            headers: {
                "User-Agent": "Niantic App"
            }
        } as any;

        ApiHandler.request.post(options, (err, response, body) =>
        {
            if (!response || !body)
            {
                ErrorHandler.throwRPCOfflineError();
            }

            try
            {
                var response = this.responseEnvelope.decode(body);

                def.resolve(response);
            }
            catch (e)
            {
                if (e.decoded)
                {
                    Logger.warn(e);
                    def.resolve(e.decoded);
                }
            }
        });

        return def.promise;
    }

    public abstract async getProfile():Promise<PlayerProfile>;

    public abstract async getHeartbeat(latitude:number, longitude:number);
}
