export interface IBuildQueryParams {
	query: Record<string, any>;
	searchableFields?: string[];
	filterableFields?: string[];
	baseConditions?: Record<string, any>[];
}
// 'mentor.user.name' -> { mentor: { user: { name: condition } } }
const createNestedCondition = (
	path: string,
	condition: any,
): Record<string, any> => {
	const keys = path.split(".");
	return keys.reduceRight((acc, key) => ({ [key]: acc }), condition);
};

export const buildPrismaWhereConditions = ({
	query,
	searchableFields = [],
	filterableFields = [],
	baseConditions = [],
}: IBuildQueryParams) => {
	const { searchTerm, page, limit, sortBy, sortOrder, ...filterData } = query;

	const andConditions: any[] = [...baseConditions];

	// ১. Search Term হ্যান্ডলিং (নরমাল ও নেস্টেড ফিল্ড সাপোর্ট)
	if (searchTerm && searchableFields.length > 0) {
		const searchCondition = {
			contains: searchTerm,
			mode: "insensitive" as const,
		};

		andConditions.push({
			OR: searchableFields.map((field) =>
				createNestedCondition(field, searchCondition),
			),
		});
	}

	// ২. Dynamic Filter হ্যান্ডলিং (নরমাল ও নেস্টেড ফিল্ড সাপোর্ট)
	if (Object.keys(filterData).length > 0) {
		const validFilters = Object.keys(filterData).filter((key) =>
			filterableFields.includes(key),
		);

		if (validFilters.length > 0) {
			andConditions.push({
				AND: validFilters.map((key) =>
					createNestedCondition(key, { equals: filterData[key] }),
				),
			});
		}
	}

	return andConditions.length > 0 ? { AND: andConditions } : {};
};
