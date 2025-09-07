module book_library::book_library {
    use std::string;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::account;
    use aptos_framework::coin;

    /// Struct representing a stored book
    struct Book has copy, drop, store {
        id: u64,
        owner: address,
        title: string::String,
        isbn: string::String,
        date: string::String,
        summary: string::String,
        cover_uri: string::String,
        book_uri: string::String,
        cost: u64,
        rented: bool,
    }

    /// Resource storing the list of books
    struct Library has key {
        books: vector<Book>,
        next_id: u64,
    }

    /// Event emitted when a book is added
    struct BookAddedEvent has copy, drop, store { id: u64, owner: address }

    /// Event emitted when a book is rented
    struct BookRentedEvent has copy, drop, store { id: u64, renter: address }

    struct Events has key { add_handle: event::EventHandle<BookAddedEvent>, rent_handle: event::EventHandle<BookRentedEvent> }

    public entry fun init(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<Library>(addr), 1);
        move_to(account, Library { books: vector::empty<Book>(), next_id: 0 });
        move_to(account, Events { add_handle: event::new_event_handle<BookAddedEvent>(account), rent_handle: event::new_event_handle<BookRentedEvent>(account) });
    }

    public entry fun add_book(account: &signer, title: string::String, isbn: string::String, date: string::String, summary: string::String, cover_uri: string::String, book_uri: string::String, cost: u64) {
        let addr = signer::address_of(account);
        if (!exists<Library>(addr)) {
            Self::init(account);
        };
        let library = borrow_global_mut<Library>(addr);
        let id = library.next_id;
        library.next_id = id + 1;
        let book = Book { id, owner: addr, title, isbn, date, summary, cover_uri, book_uri, cost, rented: false };
        vector::push_back(&mut library.books, book);
        let events = borrow_global_mut<Events>(addr);
        event::emit_event<BookAddedEvent>(&mut events.add_handle, BookAddedEvent { id, owner: addr });
    }

    public entry fun rent_book(account: &signer, owner: address, id: u64) {
        let library = borrow_global_mut<Library>(owner);
        let books_ref = &mut library.books;
        let len = vector::length(books_ref);
        let mut i = 0;
        let renter = signer::address_of(account);
        while (i < len) {
            let b_ref = vector::borrow_mut<Book>(books_ref, i);
            if (b_ref.id == id) {
                assert!(!b_ref.rented, 2);
                b_ref.rented = true;
                let events = borrow_global_mut<Events>(owner);
                event::emit_event<BookRentedEvent>(&mut events.rent_handle, BookRentedEvent { id, renter });
                return;
            };
            i = i + 1;
        };
        abort 3; // not found
    }

    /// Lightweight view returning parallel vectors of book fields for frontend consumption.
    public fun get_books(owner: address): (vector<u64>, vector<string::String>, vector<string::String>, vector<string::String>, vector<string::String>, vector<string::String>, vector<string::String>, vector<u64>, vector<bool>) acquires Library {
        if (!exists<Library>(owner)) {
            return (
                vector::empty<u64>(),
                vector::empty<string::String>(),
                vector::empty<string::String>(),
                vector::empty<string::String>(),
                vector::empty<string::String>(),
                vector::empty<string::String>(),
                vector::empty<string::String>(),
                vector::empty<u64>(),
                vector::empty<bool>()
            );
        };
        let library = borrow_global<Library>(owner);
        let ids = vector::empty<u64>();
        let titles = vector::empty<string::String>();
        let isbns = vector::empty<string::String>();
        let dates = vector::empty<string::String>();
        let summaries = vector::empty<string::String>();
        let cover_uris = vector::empty<string::String>();
        let book_uris = vector::empty<string::String>();
        let costs = vector::empty<u64>();
        let rented_flags = vector::empty<bool>();
        let len = vector::length(&library.books);
        let mut i = 0;
        while (i < len) {
            let b_ref = vector::borrow<Book>(&library.books, i);
            vector::push_back(&mut ids, b_ref.id);
            vector::push_back(&mut titles, b_ref.title.clone());
            vector::push_back(&mut isbns, b_ref.isbn.clone());
            vector::push_back(&mut dates, b_ref.date.clone());
            vector::push_back(&mut summaries, b_ref.summary.clone());
            vector::push_back(&mut cover_uris, b_ref.cover_uri.clone());
            vector::push_back(&mut book_uris, b_ref.book_uri.clone());
            vector::push_back(&mut costs, b_ref.cost);
            vector::push_back(&mut rented_flags, b_ref.rented);
            i = i + 1;
        };
        (ids, titles, isbns, dates, summaries, cover_uris, book_uris, costs, rented_flags)
    }
}
