import app = require("durandal/app");
import router = require("plugins/router");

import collection = require("models/collection");
import database = require("models/database");
import document = require("models/document");
import deleteCollection = require("viewmodels/deleteCollection");
import pagedList = require("common/pagedList");
import appUrl = require("common/appUrl");
import getCollectionsCommand = require("commands/getCollectionsCommand");
import viewModelBase = require("viewmodels/viewModelBase");
import virtualTable = require("widgets/virtualTable/viewModel");

class documents extends viewModelBase {

    displayName = "documents";
    collections = ko.observableArray<collection>();
    selectedCollection = ko.observable<collection>().subscribeTo("ActivateCollection").distinctUntilChanged();
    allDocumentsCollection: collection;
    collectionToSelectName: string;
    currentCollectionPagedItems = ko.observable<pagedList>();
    selectedDocumentIndices = ko.observableArray<number>();
    isSelectAll = ko.observable(false);
    hasAnyDocumentsSelected: KnockoutComputed<boolean>;

    static gridSelector = "#documentsGrid";

    constructor() {
        super();
        this.selectedCollection.subscribe(c => this.selectedCollectionChanged(c));
        this.hasAnyDocumentsSelected = ko.computed(() => this.selectedDocumentIndices().length > 0);
    }

    activate(args) {
        super.activate(args);
        this.activeDatabase.subscribe((db: database) => this.databaseChanged(db));

        // We can optionally pass in a collection name to view's URL, e.g. #/documents?collection=Foo&database="blahDb"
        this.collectionToSelectName = args ? args.collection : null;
        
        return this.fetchCollections(appUrl.getDatabase());
    }

    attached(view: HTMLElement, parent: HTMLElement) {
        // Initialize the context menu (using Bootstrap-ContextMenu library).
        // TypeScript doesn't know about Bootstrap-Context menu, so we cast jQuery as any.
        (<any>$('.document-collections li')).contextmenu({
            target: '#collections-context-menu'
        });

        this.useBootstrapTooltips();
    }

    collectionsLoaded(collections: Array<collection>, db: database) {
        
        // Create the "All Documents" pseudo collection.
        this.allDocumentsCollection = collection.createAllDocsCollection(db);
        this.allDocumentsCollection.documentCount = ko.computed(() =>
            this.collections()
                .filter(c => c !== this.allDocumentsCollection) // Don't include self, the all documents collection.
                .map(c => c.documentCount()) // Grab the document count of each.
                .reduce((first: number, second: number) => first + second, 0)); // And sum them up.

        // Create the "System Documents" pseudo collection.
        var systemDocumentsCollection = collection.createSystemDocsCollection(db);

        // All systems a-go. Load them into the UI and select the first one.
        var collectionsWithSysCollection = [systemDocumentsCollection].concat(collections);
        var allCollections = [this.allDocumentsCollection].concat(collectionsWithSysCollection);
        this.collections(allCollections);

        var collectionToSelect = allCollections.first(c => c.name === this.collectionToSelectName) || this.allDocumentsCollection;
        collectionToSelect.activate();

        // Fetch the collection info for each collection.
        // The collection info contains information such as total number of documents.
        collectionsWithSysCollection.forEach(c => c.fetchTotalDocumentCount());
    }

    selectedCollectionChanged(selected: collection) {
        if (selected) {
            var pagedList = selected.getDocuments();
			this.currentCollectionPagedItems(pagedList);
        }
    }

    databaseChanged(db: database) {
        if (db) {
            var documentsUrl = appUrl.forDocuments(null, db);
            router.navigate(documentsUrl, false);
            this.fetchCollections(db);
        }
    }

    deleteCollection() {
        var collection = this.selectedCollection();
        if (collection) {
            var viewModel = new deleteCollection(collection);
            viewModel.deletionTask.done(() => {
                this.collections.remove(collection);
                this.allDocumentsCollection.activate();
            });
            app.showDialog(viewModel);
        }
    }

    selectCollection(collection: collection) {
        collection.activate();
        var documentsWithCollectionUrl = appUrl.forDocuments(collection.name, this.activeDatabase());
        router.navigate(documentsWithCollectionUrl, false);
    }

    fetchCollections(db: database): JQueryPromise<Array<collection>> {
        return new getCollectionsCommand(db)
            .execute()
            .done(results => this.collectionsLoaded(results, db));
    }

    newDocument() {
        router.navigate(appUrl.forNewDoc(this.activeDatabase()));
    }

    toggleSelectAll() {
        this.isSelectAll.toggle();

        var docsGrid = this.getDocumentsGrid();
        if (docsGrid && this.isSelectAll()) {
            docsGrid.selectAll();
        } else if (docsGrid && !this.isSelectAll()) {
            docsGrid.selectNone();
        }        
    }

    editSelectedDoc() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            grid.editLastSelectedDoc();
        }
    }

    deleteSelectedDocs() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            grid.deleteSelectedDocs();
        }
    }

    copySelectedDocs() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            grid.copySelectedDocs();
        }
    }

    copySelectedDocIds() {
        var grid = this.getDocumentsGrid();
        if (grid) {
            grid.copySelectedDocIds();
        }
    }

    getDocumentsGrid(): virtualTable {
        var gridContents = $(documents.gridSelector).children()[0];
        if (gridContents) {
            return ko.dataFor(gridContents);
        }

        return null;
    }
}

export = documents;