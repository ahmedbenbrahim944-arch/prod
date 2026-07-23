import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NonconformiteComponent } from './nonconformite.component';

describe('NonconformiteComponent', () => {
  let component: NonconformiteComponent;
  let fixture: ComponentFixture<NonconformiteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NonconformiteComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NonconformiteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
