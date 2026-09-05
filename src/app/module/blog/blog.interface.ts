export interface IBlogPayload {
	title: string;
	content: string;
}

export interface IUpdateBlogPayload {
	title?: string;
	content?: string;
}
