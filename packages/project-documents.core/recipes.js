export const ProjectDocumentCollectionRecipe = {
  $type$: "Recipe", name: "ProjectDocumentCollection", rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectDocumentCollection$/ } },
    { itemprop: "owner", itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) }, isId: true },
    { itemprop: "projectId", itemtype: { type: "string" }, isId: true },
    { itemprop: "label", itemtype: { type: "string" } },
    { itemprop: "artifactRefs", itemtype: { type: "array", item: { type: "referenceToObj", allowedTypes: new Set(["ProjectSourceArtifact"]) } } },
  ],
};

export const ProjectDocumentCatalogRecipe = {
  $type$: "Recipe", name: "ProjectDocumentCatalog", rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectDocumentCatalog$/ } },
    { itemprop: "owner", itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) }, isId: true },
    { itemprop: "collectionRefs", itemtype: { type: "array", item: { type: "referenceToId", allowedTypes: new Set(["ProjectDocumentCollection"]) } } },
  ],
};

export const ProjectDocumentRecipes = [ProjectDocumentCollectionRecipe, ProjectDocumentCatalogRecipe];
