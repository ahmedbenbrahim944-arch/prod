import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListeProductiviteComponent } from './liste-productivite.component';

describe('ListeProductiviteComponent', () => {
  let component: ListeProductiviteComponent;
  let fixture: ComponentFixture<ListeProductiviteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListeProductiviteComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListeProductiviteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
