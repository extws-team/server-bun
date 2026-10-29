export type ServerData<TData extends Record<string, unknown> | undefined> = {
	id: string;
	url: URL;
	headers: Headers;
	data: TData;
};
