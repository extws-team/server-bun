export type ServerData<ClientData = undefined> = {
	id: string;
	url: URL;
	headers: Headers;
} & ([ClientData] extends [undefined]
	? { data?: undefined }
	: { data: ClientData });
