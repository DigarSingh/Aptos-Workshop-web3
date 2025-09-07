// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 < 0.9.0;


interface IERC20Token {
  function transfer(address, uint256) external returns (bool);
  function approve(address, uint256) external returns (bool);
  function transferFrom(address, address, uint256) external returns (bool);
  function totalSupply() external view returns (uint256);
  function balanceOf(address) external view returns (uint256);
  function allowance(address, address) external view returns (uint256);

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}


contract BookLibrary {

// struct for each book
  struct Book {
    //   make the owner address payable
    address payable user;
    string name;
    string image;
    string isbn;
    string date;
    string summary;
    // ipfs url for the actual book
    string book;
    uint cost;
  }
  
//   address that deployed the contract
  address public  admin;
  
//   cusd contract address
  address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

// store the length of books on the contract
  uint public booksLength = 0;
  mapping (uint => Book) internal books;
  
  
//   modifier for functions that can be called by only the owner
  
  modifier onlyOwner(uint id){
      require(msg.sender == books[id].user);
      _;
  }
  
  
  //   modifier for functions that can be called by only the admin
    modifier onlyAdmin(uint id){
      require(msg.sender == admin);
      _;
  }
  
  
    //Constructor
    constructor(){
        // initialize the admin address
        admin = msg.sender;
    }

// add a book to the blockchain
  function addBook(
    string memory _name,
    string memory _image,
    string memory _isbn, 
    string memory _date,
    string memory _summary,
    string memory _book,
    uint _cost
  ) external {
    books[booksLength] = Book(
      payable(msg.sender),
      _name,
      _image,
      _isbn,
      _date,
      _summary,
      _book,
      _cost
    );
    booksLength++;
  }


// get the details of a book
  function readBook(uint _index) external view returns (
    address,
    string memory, 
    string memory, 
    string memory, 
    string memory,
    string memory,
    string memory,
    uint
  ) {
    Book storage book = books[_index];
    return(
      book.user,
      book.name,
      book.image,
      book.isbn,
      book.date,
      book.summary,
      book.book,
      book.cost
    );
  }
  
  
//   get the cost of a book 
  function getBookCost(uint _index) internal view returns (uint){
    Book storage book = books[_index];
    // return the cost of the book
    return(book.cost);
  }
  
  //   get the owner of a book 
  function getBookOwner(uint _index) internal view returns ( address){
    Book storage book = books[_index];
    // return the adddress of the book owner
    return(payable(book.user));
  }
  
  
  
//   rent a book functionality
  function rentBook(uint _index) external returns (bool){
      
    //   get the cost of the book
      uint book_cost = getBookCost(_index);
      address book_owner = getBookOwner(_index);
      
      
    //   transfer cusd from the msg.sender to the owner
      require(
          IERC20Token(cUsdTokenAddress).transferFrom(
            msg.sender,
            book_owner,
            book_cost
          ),
          "This transaction failed"
        );
        
        // return everything went great
        return true;
      
  }
}