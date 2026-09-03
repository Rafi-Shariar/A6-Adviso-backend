interface IBuildQueryParams<T> {
	query: Record<string, any>;
	searchableFields?: string[];
	filterableFields?: string[];
	baseConditions?: Record<string, any>[];
}

export const buildPrismaWhereConditions = <T>({
	query,
	searchableFields = [],
	filterableFields = [],
	baseConditions = [],
}: IBuildQueryParams<T>) => {
	const { searchTerm, page, limit, sortBy, sortOrder, ...filterData } = query;

	const andConditions: any[] = [...baseConditions];

	// ১. Search Term হ্যান্ডলিং (OR conditions)
	if (searchTerm && searchableFields.length > 0) {
		andConditions.push({
			OR: searchableFields.map((field) => ({
				[field]: {
					contains: searchTerm,
					mode: "insensitive",
				},
			})),
		});
	}

	// ২. Dynamic Exact Filter হ্যান্ডলিং (e.g. professionalDomain, status, etc.)
	if (Object.keys(filterData).length > 0) {
		const validFilters = Object.keys(filterData).filter((key) =>
			filterableFields.includes(key),
		);

		if (validFilters.length > 0) {
			andConditions.push({
				AND: validFilters.map((key) => ({
					[key]: {
						equals: filterData[key],
					},
				})),
			});
		}
	}

	return andConditions.length > 0 ? { AND: andConditions } : {};
};
