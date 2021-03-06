import {PlayerProfile} from "../../core/models/PlayerProfile";
import {PokeIOApplication} from "../../core/PokeIOApplication";
import {CacheManager} from "../cache/CacheManager";

export class PokeIOWorker
{
    public static async getProfile():Promise<PlayerProfile>
    {
        var io = await PokeIOApplication.getIO();

        return await io.getProfile();
    }

    public static async getHeartbeatMapWithCoordinates(latitude:number, longitude:number, maxSteps = 10):Promise<any>
    {
        var step = 0.0005;
        var upperBound = (maxSteps / 2) * step;
        var lowerBound = -upperBound;

        var heartbeatPromises = [];
        for (let i = lowerBound; i <= upperBound; i += step)
        {
            for (let j = lowerBound; j <= upperBound; j += step)
            {
                let newLat = latitude + i;
                let newLng = longitude + j;

                let heartbeatPromise = PokeIOWorker.getHeartbeatWithCoordinates(newLat, newLng);
                heartbeatPromises.push(heartbeatPromise);
            }
        }

        return Promise.all(heartbeatPromises);
    }

    public static async getHeartbeatWithCoordinates(latitude:number, longitude:number):Promise<any>
    {
        var roundedLat = Math.round(latitude * 10000) / 10000;
        var roundedLong = Math.round(longitude * 10000) / 10000;

        var cacheKey = PokeIOWorker.getCacheKeyFromCoords(roundedLat, roundedLong);

        var heartbeat = await CacheManager.resolve(cacheKey, async() =>
        {
            var io = await PokeIOApplication.getIO();

            return await io.getHeartbeat(roundedLat, roundedLong);
        }, 60000);

        return heartbeat;
    }

    private static getCacheKeyFromCoords(latitude:number, longitude:number):string
    {
        return `LAT${latitude},LNG${longitude}`;
    }
}