import type {
  ApiEndpoint,
  ApiFetcher,
  ApiRequestOptions,
  EndpointFactory
} from "../../src/api-fetch/types.js";

declare const api: ApiFetcher;
declare const getEndpoint: EndpointFactory<"GET">;

const methodResult: Promise<boolean> = api.get("/method-select", {
  responseSchema: undefined,
  select: (data) => typeof data === "object" && data !== null
});
const omittedMethodSchemas: Promise<boolean> = api.get("/method-select-omitted", {
  select: (data) => typeof data === "object" && data !== null
});

const selectedEndpoint = getEndpoint("/endpoint-select", {
  params        : undefined,
  responseSchema: undefined,
  select        : (data) => typeof data === "object" && data !== null
});
const endpointResult: Promise<boolean> = api.call(selectedEndpoint);
const omittedEndpoint = getEndpoint("/endpoint-select-omitted", {
  select: (data) => typeof data === "object" && data !== null
});
const omittedEndpointResult: Promise<boolean> = api.call(omittedEndpoint);

const structuralEndpoint = {
  method : "GET",
  options: {
    params        : undefined,
    responseSchema: undefined,
    select        : (_data: unknown) => "selected"
  },
  path: "/structural"
} satisfies ApiEndpoint<undefined, undefined, undefined, string>;
const structuralResult: Promise<string> = api.call(structuralEndpoint);

const options: ApiRequestOptions<undefined, undefined, boolean> = {
  bodySchema    : undefined,
  responseSchema: undefined,
  select        : () => true
};
const omittedOptions: ApiRequestOptions<undefined, undefined, boolean> = {
  select: () => true
};

void endpointResult;
void methodResult;
void omittedEndpointResult;
void omittedMethodSchemas;
void omittedOptions;
void options;
void structuralResult;
